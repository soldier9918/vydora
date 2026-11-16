CREATE TABLE public.render_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.autopilot_plans(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'render_test' CHECK (kind IN ('render_test','autopilot')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','generating','rendering','uploading','completed','failed','cancelled')),
  progress integer NOT NULL DEFAULT 0,
  scene_cursor integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_after timestamptz NOT NULL DEFAULT now(),
  locked_by text,
  locked_until timestamptz,
  idempotency_key text NOT NULL UNIQUE,
  credits_charged integer NOT NULL DEFAULT 0,
  credits_refunded boolean NOT NULL DEFAULT false,
  output_path text,
  size_bytes bigint,
  publish boolean NOT NULL DEFAULT false,
  publish_at timestamptz,
  youtube_session_url text,
  youtube_bytes_sent bigint NOT NULL DEFAULT 0,
  youtube_video_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX render_jobs_ready_idx ON public.render_jobs (status, run_after) WHERE status IN ('queued','generating','rendering','uploading');
CREATE INDEX render_jobs_user_idx ON public.render_jobs (user_id, created_at DESC);
CREATE UNIQUE INDEX render_jobs_one_youtube_per_video ON public.render_jobs (video_id) WHERE youtube_video_id IS NOT NULL;

CREATE TABLE public.render_job_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.render_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX render_job_events_job_idx ON public.render_job_events (job_id, id);

GRANT SELECT ON public.render_jobs TO authenticated;
GRANT ALL ON public.render_jobs TO service_role;
GRANT SELECT ON public.render_job_events TO authenticated;
GRANT ALL ON public.render_job_events TO service_role;

ALTER TABLE public.render_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.render_job_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own render jobs select" ON public.render_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own render job events select" ON public.render_job_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Worker claims one job atomically with a lease; expired leases are reclaimed (worker restart recovery).
CREATE OR REPLACE FUNCTION public.claim_render_job(_worker text, _lease_seconds integer DEFAULT 300)
RETURNS SETOF public.render_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.render_jobs;
BEGIN
  SELECT * INTO j FROM public.render_jobs
   WHERE run_after <= now()
     AND ((status = 'queued') OR (status IN ('generating','rendering','uploading') AND (locked_until IS NULL OR locked_until < now())))
     AND attempts < max_attempts
   ORDER BY run_after FOR UPDATE SKIP LOCKED LIMIT 1;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE public.render_jobs SET locked_by = _worker, locked_until = now() + make_interval(secs => _lease_seconds),
    attempts = attempts + 1, status = CASE WHEN status = 'queued' THEN 'rendering' ELSE status END, updated_at = now()
   WHERE id = j.id RETURNING * INTO j;
  INSERT INTO public.render_job_events(job_id, user_id, message) VALUES (j.id, j.user_id, 'Claimed by ' || _worker || ' (attempt ' || j.attempts || ')');
  RETURN NEXT j;
END $$;

CREATE OR REPLACE FUNCTION public.heartbeat_render_job(_job uuid, _worker text, _lease_seconds integer DEFAULT 300)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH u AS (UPDATE public.render_jobs SET locked_until = now() + make_interval(secs => _lease_seconds), updated_at = now()
    WHERE id = _job AND locked_by = _worker AND status NOT IN ('completed','failed','cancelled') RETURNING 1)
  SELECT EXISTS (SELECT 1 FROM u)
$$;

-- Marks a job failed exactly once and refunds its credits once.
CREATE OR REPLACE FUNCTION public.fail_render_job(_job uuid, _worker text, _error text, _retry boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.render_jobs;
BEGIN
  SELECT * INTO j FROM public.render_jobs WHERE id = _job FOR UPDATE;
  IF NOT FOUND OR j.status IN ('completed','failed','cancelled') THEN RETURN 'noop'; END IF;
  IF j.locked_by IS DISTINCT FROM _worker THEN RETURN 'not_owner'; END IF;
  INSERT INTO public.render_job_events(job_id, user_id, level, message) VALUES (j.id, j.user_id, 'error', left(_error, 2000));
  IF _retry AND j.attempts < j.max_attempts THEN
    UPDATE public.render_jobs SET locked_by = NULL, locked_until = NULL, error = left(_error,2000),
      run_after = now() + make_interval(secs => 60 * power(2, j.attempts)::int), updated_at = now() WHERE id = j.id;
    RETURN 'retry';
  END IF;
  UPDATE public.render_jobs SET status = 'failed', locked_by = NULL, locked_until = NULL, error = left(_error,2000), updated_at = now() WHERE id = j.id;
  IF j.credits_charged > 0 AND NOT j.credits_refunded THEN
    PERFORM public.refund_credits(j.user_id, j.credits_charged, 'refund_render_job');
    UPDATE public.render_jobs SET credits_refunded = true WHERE id = j.id;
  END IF;
  RETURN 'failed';
END $$;

CREATE OR REPLACE FUNCTION public.cancel_render_job(_job uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE j public.render_jobs;
BEGIN
  SELECT * INTO j FROM public.render_jobs WHERE id = _job AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR j.status NOT IN ('queued','generating') THEN RETURN false; END IF;
  UPDATE public.render_jobs SET status = 'cancelled', locked_by = NULL, locked_until = NULL, updated_at = now() WHERE id = j.id;
  IF j.credits_charged > 0 AND NOT j.credits_refunded THEN
    PERFORM public.refund_credits(j.user_id, j.credits_charged, 'refund_render_job');
    UPDATE public.render_jobs SET credits_refunded = true WHERE id = j.id;
  END IF;
  INSERT INTO public.render_job_events(job_id, user_id, message) VALUES (j.id, j.user_id, 'Cancelled by user');
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.claim_render_job(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_render_job(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fail_render_job(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_render_job(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_render_job(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_render_job(uuid, text, text, boolean) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_render_job(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_render_job(uuid) TO authenticated;