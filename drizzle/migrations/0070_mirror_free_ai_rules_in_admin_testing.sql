ALTER TABLE public.admin_test_accounts ALTER COLUMN balance SET DEFAULT 0;
ALTER TABLE public.admin_test_accounts ADD COLUMN IF NOT EXISTS ai_eligible boolean NOT NULL DEFAULT false;
CREATE OR REPLACE FUNCTION public.admin_set_test_mode(_mode text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _mode IS NULL OR _mode NOT IN ('admin','free','creator','pro') THEN RAISE EXCEPTION 'Invalid test mode'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||auth.uid()::text));
 SELECT balance INTO b FROM public.admin_test_accounts WHERE user_id=auth.uid();
 IF _mode='free' AND COALESCE(b,0)>0 THEN INSERT INTO public.admin_test_credit_log(user_id,amount,reason) VALUES(auth.uid(),-b,'free_mode_reset'); END IF;
 INSERT INTO public.admin_test_accounts(user_id,mode,balance,ai_eligible) VALUES(auth.uid(),_mode,0,false)
 ON CONFLICT(user_id) DO UPDATE SET mode=EXCLUDED.mode,balance=CASE WHEN _mode='free' THEN 0 ELSE admin_test_accounts.balance END,ai_eligible=CASE WHEN _mode='free' THEN false ELSE admin_test_accounts.ai_eligible END,updated_at=now();
END $$;
CREATE OR REPLACE FUNCTION public.admin_adjust_test_credits(_amount integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF _amount IS NULL OR _amount=0 THEN RAISE EXCEPTION 'Enter a non-zero whole number'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||auth.uid()::text));
 SELECT balance INTO b FROM public.admin_test_accounts WHERE user_id=auth.uid();
 IF b IS NULL THEN RAISE EXCEPTION 'Choose a test plan first'; END IF;
 IF b::bigint+_amount<0 OR b::bigint+_amount>2147483647 THEN RAISE EXCEPTION 'Test balance must be zero or greater and within the supported range'; END IF;
 UPDATE public.admin_test_accounts SET balance=balance+_amount,ai_eligible=ai_eligible OR _amount>=125,updated_at=now() WHERE user_id=auth.uid() RETURNING balance INTO b;
 INSERT INTO public.admin_test_credit_log(user_id,amount,reason) VALUES(auth.uid(),_amount,CASE WHEN _amount>=125 THEN 'simulated_topup' ELSE 'manual_adjustment' END);
 RETURN b;
END $$;
CREATE OR REPLACE FUNCTION public.can_generate_ai(_user uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE m text; b integer; e boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM _user THEN RAISE EXCEPTION 'forbidden'; END IF;
 IF public.has_role(_user,'admin') THEN
  SELECT mode,balance,ai_eligible INTO m,b,e FROM public.admin_test_accounts WHERE user_id=_user;
  IF COALESCE(m,'admin')='admin' THEN RETURN true; END IF;
  RETURN COALESCE(b,0)>0 AND (m IN ('creator','pro') OR COALESCE(e,false));
 END IF;
 IF public.credit_balance(_user)<=0 THEN RETURN false; END IF;
 RETURN COALESCE((SELECT sum(g.amount) FROM public.credit_ledger g WHERE g.user_id=_user AND g.reason IN ('admin_adjustment','coupon') AND (g.livemode IS NULL OR g.livemode=public.stripe_livemode())),0)>0
 OR EXISTS (SELECT 1 FROM public.credit_ledger g WHERE g.user_id=_user AND g.amount>0
  AND g.reason IN ('topup','subscription') AND g.stripe_invoice_id IS NOT NULL AND g.livemode=public.stripe_livemode()
  AND (g.reason='subscription' OR g.amount>=125) AND (g.paid_net_pence IS NULL OR g.paid_net_pence>0)
  AND g.amount + COALESCE((SELECT sum(r.amount) FROM public.credit_ledger r WHERE r.user_id=_user AND r.stripe_invoice_id=g.stripe_invoice_id AND r.livemode=g.livemode AND r.reason IN ('refund_reversal','dispute_reversal','dispute_restored')),0)>0);
END $$;
REVOKE ALL ON FUNCTION public.admin_set_test_mode(text),public.admin_adjust_test_credits(integer),public.can_generate_ai(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_set_test_mode(text),public.admin_adjust_test_credits(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_generate_ai(uuid) TO authenticated,service_role;