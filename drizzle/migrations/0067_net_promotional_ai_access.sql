CREATE OR REPLACE FUNCTION public.can_generate_ai(_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM _user THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF public.has_role(_user,'admin') THEN RETURN true; END IF;
 IF public.credit_balance(_user)<=0 THEN RETURN false; END IF;
 RETURN COALESCE((SELECT sum(g.amount) FROM public.credit_ledger g WHERE g.user_id=_user AND g.reason IN ('admin_adjustment','coupon') AND (g.livemode IS NULL OR g.livemode=public.stripe_livemode())),0)>0
 OR EXISTS (SELECT 1 FROM public.credit_ledger g WHERE g.user_id=_user AND g.amount>0
  AND g.reason IN ('topup','subscription') AND g.stripe_invoice_id IS NOT NULL AND g.livemode=public.stripe_livemode()
  AND (g.reason='subscription' OR g.amount>=125) AND (g.paid_net_pence IS NULL OR g.paid_net_pence>0)
  AND g.amount + COALESCE((SELECT sum(r.amount) FROM public.credit_ledger r WHERE r.user_id=_user AND r.stripe_invoice_id=g.stripe_invoice_id AND r.livemode=g.livemode AND r.reason IN ('refund_reversal','dispute_reversal','dispute_restored')),0)>0);
END $$;
CREATE OR REPLACE FUNCTION public.admin_usage_costs(_days integer DEFAULT 30) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'not allowed'; END IF;
 _days := least(greatest(coalesce(_days,30),1),365);
 SELECT jsonb_build_object(
 'actions',coalesce((SELECT jsonb_agg(x) FROM (
 SELECT split_part(l.reason,':',1) AS action, CASE WHEN public.has_role(l.user_id,'admin') THEN 'admin' WHEN EXISTS(SELECT 1 FROM user_subscriptions s WHERE s.user_id=l.user_id AND s.status IN ('active','trialing')) THEN 'paid' ELSE 'free' END AS tier, count(*)::int AS n,(-sum(l.amount))::int AS credits
 FROM credit_ledger l WHERE l.amount<0 AND l.created_at>now()-make_interval(days=>_days)
 AND split_part(l.reason,':',1) NOT IN ('admin_adjustment','free_credit_removal') AND l.user_id NOT IN(SELECT user_id FROM admin_hidden_users) GROUP BY 1,2)x),'[]'::jsonb),
 'revenue_pence',coalesce((SELECT sum(paid_net_pence) FROM credit_ledger WHERE livemode IS TRUE AND paid_net_pence>0 AND created_at>now()-make_interval(days=>_days)),0)) INTO r;
 RETURN r;
END $$;