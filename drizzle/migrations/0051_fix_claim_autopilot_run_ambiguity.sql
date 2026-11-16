CREATE OR REPLACE FUNCTION public.claim_autopilot_run(_worker text, _lease_seconds integer DEFAULT 240)
 RETURNS SETOF public.autopilot_runs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE _claimed public.autopilot_runs;
BEGIN
  WITH ins AS (
    INSERT INTO public.autopilot_runs(plan_id, user_id)
    SELECT p.id, p.user_id FROM public.autopilot_plans p
     WHERE p.cloud IS TRUE AND p.status = 'planned' AND p.create_on <= pg_catalog.now()
       AND public.has_role(p.user_id, 'admin'::public.app_role)
    ON CONFLICT (plan_id) DO NOTHING
    RETURNING plan_id)
  UPDATE public.autopilot_plans p SET status = 'queued', note = NULL FROM ins WHERE p.id = ins.plan_id AND p.status = 'planned';

  UPDATE public.autopilot_runs ar SET status = 'cancelled', locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now(),
         error = 'Automatic making was turned off or the plan changed'
    FROM public.autopilot_plans p
   WHERE ar.plan_id = p.id AND ar.status = 'generating' AND (ar.locked_until IS NULL OR ar.locked_until < pg_catalog.now())
     AND (p.cloud IS NOT TRUE OR p.status <> 'queued' OR NOT public.has_role(p.user_id, 'admin'::public.app_role));

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
     AND p.cloud IS TRUE AND p.status = 'queued' AND public.has_role(p.user_id, 'admin'::public.app_role)
   ORDER BY r2.run_after FOR UPDATE OF r2 SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.autopilot_runs ar2 SET locked_by = _worker,
    locked_until = pg_catalog.now() + pg_catalog.make_interval(secs => _lease_seconds),
    attempts = ar2.attempts + 1, updated_at = pg_catalog.now() WHERE ar2.id = _claimed.id RETURNING ar2.* INTO _claimed;
  RETURN NEXT _claimed;
END $function$;

REVOKE ALL ON FUNCTION public.claim_autopilot_run(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_autopilot_run(text, integer) TO service_role;