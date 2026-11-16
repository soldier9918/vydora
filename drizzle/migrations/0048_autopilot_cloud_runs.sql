ALTER TABLE public.autopilot_plans ADD COLUMN IF NOT EXISTS cloud boolean NOT NULL DEFAULT false;
ALTER TABLE public.autopilot_plans ADD COLUMN IF NOT EXISTS note text;

CREATE TABLE public.autopilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL UNIQUE REFERENCES public.autopilot_plans(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'generating',
  video_id uuid,
  render_job_id uuid,
  attempts integer NOT NULL DEFAULT 0,
  locked_by text,
  locked_until timestamptz,
  run_after timestamptz NOT NULL DEFAULT now(),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.autopilot_runs TO authenticated;
GRANT ALL ON public.autopilot_runs TO service_role;
ALTER TABLE public.autopilot_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own autopilot runs select" ON public.autopilot_runs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Queue due cloud plans once each, then lease one run to the caller. Admin-only until proven.
CREATE OR REPLACE FUNCTION public.claim_autopilot_run(_worker text, _lease_seconds integer DEFAULT 240)
RETURNS SETOF public.autopilot_runs LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.autopilot_runs;
BEGIN
  INSERT INTO public.autopilot_runs(plan_id, user_id)
  SELECT p.id, p.user_id FROM public.autopilot_plans p
   WHERE p.cloud AND p.status = 'planned' AND p.create_on <= now() AND public.has_role(p.user_id, 'admin')
  ON CONFLICT (plan_id) DO NOTHING;
  UPDATE public.autopilot_plans p SET status = 'queued', note = NULL
   WHERE p.status = 'planned' AND EXISTS (SELECT 1 FROM public.autopilot_runs r2 WHERE r2.plan_id = p.id);
  SELECT * INTO r FROM public.autopilot_runs
   WHERE status = 'generating' AND run_after <= now() AND (locked_until IS NULL OR locked_until < now()) AND attempts < 30
   ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.autopilot_runs SET locked_by = _worker, locked_until = now() + make_interval(secs => _lease_seconds),
    attempts = attempts + 1, updated_at = now() WHERE id = r.id RETURNING * INTO r;
  RETURN NEXT r;
END $$;
REVOKE ALL ON FUNCTION public.claim_autopilot_run(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_autopilot_run(text, integer) TO service_role;