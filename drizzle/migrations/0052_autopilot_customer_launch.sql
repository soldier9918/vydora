CREATE TABLE public.app_flags (key text PRIMARY KEY, enabled boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.app_flags TO service_role;
ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.autopilot_plans ADD COLUMN publish_consent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.autopilot_cloud_eligible(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT public.has_role(_user, 'admin'::public.app_role)
      OR (COALESCE((SELECT f.enabled FROM public.app_flags f WHERE f.key = 'autopilot_customers'), false)
          AND public.has_active_subscription(_user)) $$;
REVOKE ALL ON FUNCTION public.autopilot_cloud_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.autopilot_cloud_eligible(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.autopilot_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
  SELECT pg_catalog.jsonb_build_object(
    'eligible', auth.uid() IS NOT NULL AND public.autopilot_cloud_eligible(auth.uid()),
    'launched', COALESCE((SELECT f.enabled FROM public.app_flags f WHERE f.key = 'autopilot_customers'), false),
    'subscribed', auth.uid() IS NOT NULL AND public.has_active_subscription(auth.uid()),
    'admin', auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin'::public.app_role)) $$;
REVOKE ALL ON FUNCTION public.autopilot_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.autopilot_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_autopilot_launch(_enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN RAISE EXCEPTION 'not allowed'; END IF;
  INSERT INTO public.app_flags(key, enabled, updated_at) VALUES ('autopilot_customers', _enabled, pg_catalog.now())
  ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = pg_catalog.now();
  RETURN _enabled;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_autopilot_launch(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_autopilot_launch(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_autopilot_cloud()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NEW.cloud IS TRUE AND (TG_OP = 'INSERT' OR OLD.cloud IS NOT TRUE) AND NOT public.autopilot_cloud_eligible(NEW.user_id) THEN
    RAISE EXCEPTION 'Automatic making needs an active Creator or Pro plan.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER autopilot_cloud_guard BEFORE INSERT OR UPDATE OF cloud ON public.autopilot_plans
  FOR EACH ROW EXECUTE FUNCTION public.guard_autopilot_cloud();

CREATE OR REPLACE FUNCTION public.claim_autopilot_run(_worker text, _lease_seconds integer DEFAULT 240)
 RETURNS SETOF public.autopilot_runs LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE _claimed public.autopilot_runs;
BEGIN
  WITH ins AS (
    INSERT INTO public.autopilot_runs(plan_id, user_id)
    SELECT p.id, p.user_id FROM public.autopilot_plans p
     WHERE p.cloud IS TRUE AND p.status = 'planned' AND p.create_on <= pg_catalog.now()
       AND public.autopilot_cloud_eligible(p.user_id)
    ON CONFLICT (plan_id) DO NOTHING
    RETURNING plan_id)
  UPDATE public.autopilot_plans p SET status = 'queued', note = NULL FROM ins WHERE p.id = ins.plan_id AND p.status = 'planned';

  -- Due plans whose owner is no longer eligible are skipped with a clear note (nothing charged).
  UPDATE public.autopilot_plans p SET status = 'skipped', note = 'Skipped: automatic making needs an active Creator or Pro plan.'
   WHERE p.cloud IS TRUE AND p.status = 'planned' AND p.create_on <= pg_catalog.now()
     AND NOT public.autopilot_cloud_eligible(p.user_id);

  UPDATE public.autopilot_runs ar SET status = 'cancelled', locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now(),
         error = 'Automatic making was turned off or the plan changed'
    FROM public.autopilot_plans p
   WHERE ar.plan_id = p.id AND ar.status = 'generating' AND (ar.locked_until IS NULL OR ar.locked_until < pg_catalog.now())
     AND (p.cloud IS NOT TRUE OR p.status <> 'queued' OR NOT public.autopilot_cloud_eligible(p.user_id));

  WITH dead AS (
    UPDATE public.autopilot_runs ar SET status = 'failed', locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now(),
           error = COALESCE(ar.error, 'Stopped after 3 failed attempts')
     WHERE ar.status = 'generating' AND ar.attempts >= 3 AND (ar.locked_until IS NULL OR ar.locked_until < pg_catalog.now())
    RETURNING ar.plan_id AS dead_plan, ar.error AS dead_error)
  UPDATE public.autopilot_plans p SET status = 'failed', note = 'Stopped after 3 failed attempts: ' || pg_catalog.left(dead.dead_error, 300)
    FROM dead WHERE p.id = dead.dead_plan;

  SELECT r2.* INTO _claimed FROM public.autopilot_runs r2 JOIN public.autopilot_plans p ON p.id = r2.plan_id
   WHERE r2.status = 'generating' AND r2.run_after <= pg_catalog.now()
     AND (r2.locked_until IS NULL OR r2.locked_until < pg_catalog.now()) AND r2.attempts < 3
     AND p.cloud IS TRUE AND p.status = 'queued' AND public.autopilot_cloud_eligible(p.user_id)
   ORDER BY r2.run_after FOR UPDATE OF r2 SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.autopilot_runs ar2 SET locked_by = _worker,
    locked_until = pg_catalog.now() + pg_catalog.make_interval(secs => _lease_seconds),
    attempts = ar2.attempts + 1, updated_at = pg_catalog.now() WHERE ar2.id = _claimed.id RETURNING ar2.* INTO _claimed;
  RETURN NEXT _claimed;
END $function$;
REVOKE ALL ON FUNCTION public.claim_autopilot_run(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_autopilot_run(text, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.retry_autopilot_plan(_plan uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.autopilot_cloud_eligible(me) THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.autopilot_plans WHERE id = _plan AND user_id = me AND cloud IS TRUE AND status IN ('skipped','failed')) THEN RETURN false; END IF;
  UPDATE public.autopilot_runs SET status = 'generating', attempts = 0, error = NULL, run_after = pg_catalog.now(),
    locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now()
   WHERE plan_id = _plan AND user_id = me;
  UPDATE public.autopilot_plans SET status = CASE WHEN EXISTS (SELECT 1 FROM public.autopilot_runs WHERE plan_id = _plan) THEN 'queued' ELSE 'planned' END, note = NULL
   WHERE id = _plan AND user_id = me;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.retry_autopilot_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_autopilot_plan(uuid) TO authenticated;