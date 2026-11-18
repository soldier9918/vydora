CREATE TABLE public.admin_hidden_users (
  user_id uuid PRIMARY KEY,
  hidden_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_hidden_users TO service_role;
ALTER TABLE public.admin_hidden_users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.admin_hidden_users(user_id)
SELECT id FROM auth.users WHERE lower(email) LIKE '%@example.com'
   OR lower(email) IN ('cyberjungleyt@gmail.com','help@travelspinwheel.com')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_set_user_hidden(_user uuid, _hidden boolean)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _hidden THEN INSERT INTO public.admin_hidden_users(user_id) VALUES (_user) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.admin_hidden_users WHERE user_id = _user; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_user_hidden(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_user_hidden(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN (WITH u AS (SELECT * FROM auth.users x WHERE NOT EXISTS (SELECT 1 FROM admin_hidden_users h WHERE h.user_id = x.id)),
   l AS (SELECT * FROM credit_ledger c WHERE c.livemode IS DISTINCT FROM false AND c.user_id IN (SELECT id FROM u)),
   v AS (SELECT * FROM videos w WHERE w.user_id IN (SELECT id FROM u))
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM u),
    'users_7d', (SELECT count(*) FROM u WHERE created_at > now() - interval '7 days'),
    'users_30d', (SELECT count(*) FROM u WHERE created_at > now() - interval '30 days'),
    'active_7d', (SELECT count(*) FROM u WHERE last_sign_in_at > now() - interval '7 days'),
    'videos', (SELECT count(*) FROM v),
    'videos_7d', (SELECT count(*) FROM v WHERE created_at > now() - interval '7 days'),
    'scenes', (SELECT count(*) FROM video_scenes s WHERE s.video_id IN (SELECT id FROM v)),
    'animated', (SELECT count(*) FROM video_scenes s WHERE s.video_id IN (SELECT id FROM v) AND clip_path IS NOT NULL AND clip_credit IS NULL),
    'credits_issued', (SELECT coalesce(sum(amount),0) FROM l WHERE amount > 0),
    'credits_spent', (SELECT coalesce(-sum(amount),0) FROM l WHERE amount < 0),
    'referrals', (SELECT count(*) FROM credit_accounts a WHERE referred_by IS NOT NULL AND a.user_id IN (SELECT id FROM u)),
    'paying_users', (SELECT count(DISTINCT user_id) FROM l WHERE reason IN ('purchase','topup','subscription') AND amount > 0 AND livemode = true),
    'paid_credits', (SELECT coalesce(sum(amount),0) FROM l WHERE reason IN ('purchase','topup','subscription') AND amount > 0 AND livemode = true),
    'live_subscribers', (SELECT count(*) FROM user_subscriptions s WHERE livemode = true AND status IN ('active','trialing','past_due') AND s.user_id IN (SELECT id FROM u)),
    'signups_by_day', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) ORDER BY d),'[]') FROM (
       SELECT date_trunc('day', created_at)::date d, count(*) n FROM u WHERE created_at > now() - interval '30 days' GROUP BY 1) s)
  ));
END $function$;

CREATE OR REPLACE FUNCTION public.admin_users()
 RETURNS TABLE(user_id uuid, email text, created_at timestamp with time zone, last_sign_in_at timestamp with time zone, confirmed boolean, provider text, balance bigint, paid_total bigint, plan text, referral_code text, referred_by_email text, invites bigint, videos bigint, is_admin boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at IS NOT NULL,
    coalesce(u.raw_app_meta_data->>'provider','email'),
    coalesce((SELECT sum(l.amount) FROM credit_ledger l WHERE l.user_id = u.id AND l.livemode IS DISTINCT FROM false),0)::bigint,
    coalesce((SELECT sum(l.amount) FROM credit_ledger l WHERE l.user_id = u.id AND l.reason IN ('purchase','topup','subscription') AND l.amount > 0 AND l.livemode = true),0)::bigint,
    coalesce((SELECT l.reason FROM credit_ledger l WHERE l.user_id = u.id AND l.reason IN ('subscription','topup','purchase') AND l.livemode = true ORDER BY l.created_at DESC LIMIT 1),'free'),
    a.referral_code,
    (SELECT r.email::text FROM auth.users r WHERE r.id = a.referred_by),
    (SELECT count(*) FROM credit_accounts c WHERE c.referred_by = u.id),
    (SELECT count(*) FROM videos v WHERE v.user_id = u.id),
    public.has_role(u.id, 'admin')
  FROM auth.users u LEFT JOIN credit_accounts a ON a.user_id = u.id
  WHERE NOT EXISTS (SELECT 1 FROM admin_hidden_users h WHERE h.user_id = u.id)
  ORDER BY u.created_at DESC;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_videos(_limit integer DEFAULT 100)
 RETURNS TABLE(id uuid, title text, email text, style text, voice text, aspect_ratio text, quality text, scenes bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT v.id, v.title, u.email::text, v.style, v.voice, v.aspect_ratio, v.quality,
    (SELECT count(*) FROM video_scenes s WHERE s.video_id = v.id), v.created_at
  FROM videos v LEFT JOIN auth.users u ON u.id = v.user_id
  WHERE NOT EXISTS (SELECT 1 FROM admin_hidden_users h WHERE h.user_id = v.user_id)
  ORDER BY v.created_at DESC LIMIT _limit;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_ledger(_limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, email text, amount integer, reason text, created_at timestamp with time zone, livemode boolean)
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT l.id, u.email::text, l.amount, l.reason, l.created_at, l.livemode
  FROM credit_ledger l LEFT JOIN auth.users u ON u.id = l.user_id
  WHERE l.livemode IS DISTINCT FROM false
    AND NOT EXISTS (SELECT 1 FROM admin_hidden_users h WHERE h.user_id = l.user_id)
  ORDER BY l.created_at DESC LIMIT _limit;
END $function$;