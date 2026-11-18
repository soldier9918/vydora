CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'users', (SELECT count(*) FROM auth.users),
    'users_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'users_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'active_7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days'),
    'videos', (SELECT count(*) FROM public.videos),
    'videos_7d', (SELECT count(*) FROM public.videos WHERE created_at > now() - interval '7 days'),
    'scenes', (SELECT count(*) FROM public.video_scenes),
    'animated', (SELECT count(*) FROM public.video_scenes WHERE clip_path IS NOT NULL AND clip_credit IS NULL),
    'credits_issued', (SELECT coalesce(sum(amount),0) FROM public.credit_ledger WHERE amount > 0 AND livemode IS DISTINCT FROM false),
    'credits_spent', (SELECT coalesce(-sum(amount),0) FROM public.credit_ledger WHERE amount < 0),
    'referrals', (SELECT count(*) FROM public.credit_accounts WHERE referred_by IS NOT NULL),
    'paying_users', (SELECT count(DISTINCT user_id) FROM public.credit_ledger WHERE reason IN ('purchase','topup','subscription') AND amount > 0 AND livemode = true),
    'paid_credits', (SELECT coalesce(sum(amount),0) FROM public.credit_ledger WHERE reason IN ('purchase','topup','subscription') AND amount > 0 AND livemode = true),
    'live_subscribers', (SELECT count(*) FROM public.user_subscriptions WHERE livemode = true AND status IN ('active','trialing','past_due')),
    'test_paying_users', (SELECT count(DISTINCT user_id) FROM public.credit_ledger WHERE reason IN ('purchase','topup','subscription') AND amount > 0 AND livemode = false),
    'test_subscribers', (SELECT count(*) FROM public.user_subscriptions WHERE livemode = false AND status IN ('active','trialing','past_due')),
    'test_credits_issued', (SELECT coalesce(sum(amount),0) FROM public.credit_ledger WHERE amount > 0 AND livemode = false),
    'signups_by_day', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) ORDER BY d),'[]') FROM (
       SELECT date_trunc('day', created_at)::date d, count(*) n FROM auth.users WHERE created_at > now() - interval '30 days' GROUP BY 1) s)
  );
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
    coalesce((SELECT sum(l.amount) FROM credit_ledger l WHERE l.user_id = u.id),0)::bigint,
    coalesce((SELECT sum(l.amount) FROM credit_ledger l WHERE l.user_id = u.id AND l.reason IN ('purchase','topup','subscription') AND l.amount > 0 AND l.livemode = true),0)::bigint,
    coalesce((SELECT l.reason FROM credit_ledger l WHERE l.user_id = u.id AND l.reason IN ('subscription','topup','purchase') AND l.livemode = true ORDER BY l.created_at DESC LIMIT 1),'free'),
    a.referral_code,
    (SELECT r.email::text FROM auth.users r WHERE r.id = a.referred_by),
    (SELECT count(*) FROM credit_accounts c WHERE c.referred_by = u.id),
    (SELECT count(*) FROM videos v WHERE v.user_id = u.id),
    public.has_role(u.id, 'admin')
  FROM auth.users u LEFT JOIN credit_accounts a ON a.user_id = u.id
  ORDER BY u.created_at DESC;
END $function$;