ALTER TABLE public.credit_accounts ADD COLUMN IF NOT EXISTS free_credit_review text;
ALTER TABLE public.credit_accounts ADD COLUMN IF NOT EXISTS free_credit_reconciled_at timestamptz;

CREATE OR REPLACE FUNCTION public.can_generate_ai(_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM _user THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF public.has_role(_user,'admin') THEN RETURN true; END IF;
 IF public.credit_balance(_user)<=0 THEN RETURN false; END IF;
 RETURN EXISTS (
  SELECT 1 FROM public.credit_ledger g WHERE g.user_id=_user AND g.amount>0
  AND ((g.reason IN ('admin_adjustment','coupon') AND g.livemode IS DISTINCT FROM false)
   OR (g.reason IN ('topup','subscription') AND g.stripe_invoice_id IS NOT NULL AND g.livemode=public.stripe_livemode()
    AND (g.reason='subscription' OR g.amount>=125) AND (g.paid_net_pence IS NULL OR g.paid_net_pence>0)
    AND g.amount + COALESCE((SELECT sum(r.amount) FROM public.credit_ledger r WHERE r.user_id=_user AND r.stripe_invoice_id=g.stripe_invoice_id AND r.livemode=g.livemode AND r.reason IN ('refund_reversal','dispute_reversal','dispute_restored')),0)>0)));
END $$;
REVOKE ALL ON FUNCTION public.can_generate_ai(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_generate_ai(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.admin_credit_sources() RETURNS TABLE(user_id uuid, balance bigint, topup_granted bigint, subscription_granted bigint, promotion_granted bigint, historical_free bigint, free_removed bigint, review text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN QUERY SELECT a.user_id, public.credit_balance(a.user_id),
 COALESCE(sum(l.amount) FILTER(WHERE l.amount>0 AND l.reason='topup'),0)::bigint,
 COALESCE(sum(l.amount) FILTER(WHERE l.amount>0 AND l.reason='subscription'),0)::bigint,
 COALESCE(sum(l.amount) FILTER(WHERE l.amount>0 AND l.reason IN ('admin_adjustment','coupon')),0)::bigint,
 COALESCE(sum(l.amount) FILTER(WHERE l.amount>0 AND l.reason IN ('starter','monthly_free')),0)::bigint,
 COALESCE(-sum(l.amount) FILTER(WHERE l.reason='free_credit_removal'),0)::bigint,
 a.free_credit_review
 FROM public.credit_accounts a LEFT JOIN public.credit_ledger l ON l.user_id=a.user_id AND (l.livemode IS NULL OR l.livemode=public.stripe_livemode())
 GROUP BY a.user_id,a.free_credit_review;
END $$;
REVOKE ALL ON FUNCTION public.admin_credit_sources() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_credit_sources() TO authenticated,service_role;