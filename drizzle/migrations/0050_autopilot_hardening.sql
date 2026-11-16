DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.render_jobs WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate render_jobs.idempotency_key values found; aborting without changing data';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS render_jobs_idempotency_key_idx ON public.render_jobs (idempotency_key);

CREATE OR REPLACE FUNCTION public.claim_autopilot_run(_worker text, _lease_seconds integer DEFAULT 240)
RETURNS SETOF public.autopilot_runs LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE r public.autopilot_runs;
BEGIN
  -- Queue due admin cloud plans; mark queued only the plans whose run was inserted here.
  WITH ins AS (
    INSERT INTO public.autopilot_runs(plan_id, user_id)
    SELECT p.id, p.user_id FROM public.autopilot_plans p
     WHERE p.cloud IS TRUE AND p.status = 'planned' AND p.create_on <= pg_catalog.now()
       AND public.has_role(p.user_id, 'admin'::public.app_role)
    ON CONFLICT (plan_id) DO NOTHING
    RETURNING plan_id)
  UPDATE public.autopilot_plans p SET status = 'queued', note = NULL FROM ins WHERE p.id = ins.plan_id AND p.status = 'planned';

  -- Cancel runs whose plan is no longer an active admin cloud plan.
  UPDATE public.autopilot_runs r SET status = 'cancelled', locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now(),
         error = 'Automatic making was turned off or the plan changed'
    FROM public.autopilot_plans p
   WHERE r.plan_id = p.id AND r.status = 'generating' AND (r.locked_until IS NULL OR r.locked_until < pg_catalog.now())
     AND (p.cloud IS NOT TRUE OR p.status <> 'queued' OR NOT public.has_role(p.user_id, 'admin'::public.app_role));

  -- Runs that used all 3 consecutive attempts become failed.
  WITH dead AS (
    UPDATE public.autopilot_runs r SET status = 'failed', locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now(),
           error = COALESCE(r.error, 'Stopped after 3 failed attempts')
     WHERE r.status = 'generating' AND r.attempts >= 3 AND (r.locked_until IS NULL OR r.locked_until < pg_catalog.now())
    RETURNING r.plan_id, r.error)
  UPDATE public.autopilot_plans p SET status = 'failed', note = 'Stopped after 3 failed attempts: ' || pg_catalog.left(dead.error, 300)
    FROM dead WHERE p.id = dead.plan_id;

  SELECT r2.* INTO r FROM public.autopilot_runs r2 JOIN public.autopilot_plans p ON p.id = r2.plan_id
   WHERE r2.status = 'generating' AND r2.run_after <= pg_catalog.now()
     AND (r2.locked_until IS NULL OR r2.locked_until < pg_catalog.now()) AND r2.attempts < 3
     AND p.cloud IS TRUE AND p.status = 'queued' AND public.has_role(p.user_id, 'admin'::public.app_role)
   ORDER BY r2.run_after FOR UPDATE OF r2 SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.autopilot_runs SET locked_by = _worker,
    locked_until = pg_catalog.now() + pg_catalog.make_interval(secs => _lease_seconds),
    attempts = attempts + 1, updated_at = pg_catalog.now() WHERE id = r.id RETURNING * INTO r;
  RETURN NEXT r;
END $$;
REVOKE ALL ON FUNCTION public.claim_autopilot_run(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_autopilot_run(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.heartbeat_autopilot_run(_run uuid, _worker text, _lease_seconds integer DEFAULT 240)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  WITH u AS (UPDATE public.autopilot_runs SET locked_until = pg_catalog.now() + pg_catalog.make_interval(secs => _lease_seconds), updated_at = pg_catalog.now()
    WHERE id = _run AND locked_by = _worker AND status = 'generating' RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u)
$$;
REVOKE ALL ON FUNCTION public.heartbeat_autopilot_run(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.heartbeat_autopilot_run(uuid, text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_autopilot_plan(_plan uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.has_role(me, 'admin'::public.app_role) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.autopilot_plans WHERE id = _plan AND user_id = me AND cloud IS TRUE AND status IN ('skipped','failed')) THEN RETURN false; END IF;
  -- Keeps any video already written; only missing pictures/voices are made (and charged) on retry.
  UPDATE public.autopilot_runs SET status = 'generating', attempts = 0, error = NULL, run_after = pg_catalog.now(),
    locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now()
   WHERE plan_id = _plan AND user_id = me;
  UPDATE public.autopilot_plans SET status = CASE WHEN EXISTS (SELECT 1 FROM public.autopilot_runs WHERE plan_id = _plan) THEN 'queued' ELSE 'planned' END, note = NULL
   WHERE id = _plan AND user_id = me;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.retry_autopilot_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_autopilot_plan(uuid) TO authenticated;