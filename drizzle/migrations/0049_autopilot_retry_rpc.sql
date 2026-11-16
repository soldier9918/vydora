CREATE OR REPLACE FUNCTION public.retry_autopilot_plan(_plan uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.autopilot_plans WHERE id = _plan AND user_id = auth.uid() AND status IN ('skipped','failed')) THEN RETURN false; END IF;
  -- Keeps any video already written; only missing pictures/voices are made (and charged) on retry.
  UPDATE public.autopilot_runs SET status = 'generating', attempts = 0, error = NULL, run_after = now(), locked_by = NULL, locked_until = NULL, updated_at = now()
   WHERE plan_id = _plan AND user_id = auth.uid();
  UPDATE public.autopilot_plans SET status = CASE WHEN EXISTS (SELECT 1 FROM public.autopilot_runs WHERE plan_id = _plan) THEN 'queued' ELSE 'planned' END, note = NULL WHERE id = _plan;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.retry_autopilot_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retry_autopilot_plan(uuid) TO authenticated;