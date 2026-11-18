ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new';

CREATE OR REPLACE FUNCTION public.admin_feedback()
RETURNS TABLE(id uuid, email text, account_email text, category text, message text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT f.id, f.email, u.email::text, f.category, f.message, f.status, f.created_at
    FROM public.feedback f LEFT JOIN auth.users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT 500;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_feedback_status(_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _status NOT IN ('new','in_review','resolved') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.feedback SET status = _status WHERE id = _id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_autopilot_queue()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'worker', (SELECT jsonb_build_object('locked_by', x.locked_by, 'last_seen', x.t) FROM (
        SELECT locked_by, updated_at t FROM public.render_jobs WHERE locked_by IS NOT NULL
        UNION ALL SELECT locked_by, updated_at FROM public.autopilot_runs WHERE locked_by IS NOT NULL
        ORDER BY 2 DESC LIMIT 1) x),
    'last_activity', GREATEST((SELECT max(updated_at) FROM public.render_jobs), (SELECT max(updated_at) FROM public.autopilot_runs)),
    'plans', COALESCE((SELECT jsonb_agg(row_to_json(p) ORDER BY p.create_on DESC) FROM (
        SELECT pl.id, pl.topic, pl.status, pl.create_on, pl.publish_on, pl.note, pl.cloud, u.email::text AS email,
               r.status AS run_status, r.attempts, r.error AS run_error, r.locked_by,
               j.status AS render_status, j.progress, j.error AS render_error
          FROM public.autopilot_plans pl LEFT JOIN auth.users u ON u.id = pl.user_id
          LEFT JOIN public.autopilot_runs r ON r.plan_id = pl.id
          LEFT JOIN public.render_jobs j ON j.id = r.render_job_id
         ORDER BY pl.create_on DESC LIMIT 200) p), '[]'::jsonb),
    'renders', COALESCE((SELECT jsonb_agg(row_to_json(j) ORDER BY j.created_at DESC) FROM (
        SELECT rj.id, rj.kind, rj.status, rj.progress, rj.attempts, rj.error, rj.credits_charged, rj.credits_refunded, rj.created_at, u.email::text AS email
          FROM public.render_jobs rj LEFT JOIN auth.users u ON u.id = rj.user_id ORDER BY rj.created_at DESC LIMIT 100) j), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.admin_retry_autopilot_plan(_plan uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.autopilot_plans WHERE id = _plan AND cloud IS TRUE AND status IN ('skipped','failed')) THEN RETURN false; END IF;
  UPDATE public.autopilot_runs SET status = 'generating', attempts = 0, error = NULL, run_after = pg_catalog.now(),
    locked_by = NULL, locked_until = NULL, updated_at = pg_catalog.now() WHERE plan_id = _plan;
  UPDATE public.autopilot_plans SET status = CASE WHEN EXISTS (SELECT 1 FROM public.autopilot_runs WHERE plan_id = _plan) THEN 'queued' ELSE 'planned' END, note = NULL
   WHERE id = _plan;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_user_detail(_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'email', (SELECT email::text FROM auth.users WHERE id = _user),
    'balance', public.credit_balance(_user),
    'subscription', (SELECT jsonb_build_object('plan', s.plan_tier, 'status', s.status, 'period_end', s.current_period_end, 'cancel_at_period_end', s.cancel_at_period_end, 'customer', s.stripe_customer_id)
        FROM public.user_subscriptions s WHERE s.user_id = _user AND s.livemode = public.stripe_livemode()),
    'youtube', (SELECT jsonb_build_object('channel', c.channel_title, 'connected_at', c.connected_at) FROM public.youtube_connections c WHERE c.user_id = _user),
    'videos', COALESCE((SELECT jsonb_agg(row_to_json(v) ORDER BY v.created_at DESC) FROM (
        SELECT id, title, aspect_ratio, quality, target_seconds, created_at FROM public.videos WHERE user_id = _user ORDER BY created_at DESC LIMIT 50) v), '[]'::jsonb),
    'ledger', COALESCE((SELECT jsonb_agg(row_to_json(l) ORDER BY l.created_at DESC) FROM (
        SELECT amount, reason, created_at FROM public.credit_ledger WHERE user_id = _user AND livemode IS DISTINCT FROM false ORDER BY created_at DESC LIMIT 100) l), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.admin_health()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE since timestamptz := pg_catalog.now() - interval '24 hours';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'exports', jsonb_build_object('total', (SELECT count(*) FROM public.video_exports WHERE created_at > since), 'failed', (SELECT count(*) FROM public.video_exports WHERE created_at > since AND status = 'failed')),
    'cloud_renders', jsonb_build_object('total', (SELECT count(*) FROM public.render_jobs WHERE created_at > since), 'failed', (SELECT count(*) FROM public.render_jobs WHERE created_at > since AND status = 'failed')),
    'autopilot', jsonb_build_object('total', (SELECT count(*) FROM public.autopilot_runs WHERE updated_at > since), 'failed', (SELECT count(*) FROM public.autopilot_runs WHERE updated_at > since AND status = 'failed')),
    'youtube', jsonb_build_object('total', (SELECT count(*) FROM public.youtube_uploads WHERE created_at > since), 'failed', (SELECT count(*) FROM public.youtube_uploads WHERE created_at > since AND status IN ('failed','error'))),
    'refunds', (SELECT count(*) FROM public.credit_ledger WHERE created_at > since AND reason LIKE 'refund%'),
    'spends', (SELECT count(*) FROM public.credit_ledger WHERE created_at > since AND amount < 0));
END $$;

CREATE OR REPLACE FUNCTION public.admin_hidden_list()
RETURNS TABLE(user_id uuid, email text, hidden_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT h.user_id, u.email::text, h.hidden_at FROM public.admin_hidden_users h LEFT JOIN auth.users u ON u.id = h.user_id ORDER BY h.hidden_at DESC;
END $$;

REVOKE ALL ON FUNCTION public.admin_feedback(), public.admin_set_feedback_status(uuid,text), public.admin_autopilot_queue(), public.admin_retry_autopilot_plan(uuid), public.admin_user_detail(uuid), public.admin_health(), public.admin_hidden_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_feedback(), public.admin_set_feedback_status(uuid,text), public.admin_autopilot_queue(), public.admin_retry_autopilot_plan(uuid), public.admin_user_detail(uuid), public.admin_health(), public.admin_hidden_list() TO authenticated;