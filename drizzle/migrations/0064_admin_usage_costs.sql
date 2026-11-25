CREATE OR REPLACE FUNCTION public.admin_usage_costs(_days integer DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
  _days := least(greatest(coalesce(_days,30),1),365);
  SELECT jsonb_build_object(
    'actions', coalesce((SELECT jsonb_agg(x) FROM (
      SELECT split_part(l.reason,':',1) AS action,
        CASE WHEN public.has_role(l.user_id,'admin') THEN 'admin'
             WHEN EXISTS (SELECT 1 FROM user_subscriptions s WHERE s.user_id=l.user_id AND s.status IN ('active','trialing')) THEN 'paid'
             ELSE 'free' END AS tier,
        count(*)::int AS n, (-sum(l.amount))::int AS credits
      FROM credit_ledger l
      WHERE l.amount < 0 AND l.created_at > now() - make_interval(days => _days)
        AND split_part(l.reason,':',1) <> 'admin_adjustment'
        AND l.user_id NOT IN (SELECT user_id FROM admin_hidden_users)
      GROUP BY 1,2) x), '[]'::jsonb),
    'revenue_pence', coalesce((SELECT sum(paid_net_pence) FROM credit_ledger
      WHERE livemode IS TRUE AND paid_net_pence > 0 AND created_at > now() - make_interval(days => _days)),0)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.admin_usage_costs(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_usage_costs(integer) TO authenticated;