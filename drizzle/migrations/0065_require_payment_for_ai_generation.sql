CREATE OR REPLACE FUNCTION public.ai_payment_eligible(_admin boolean, _paid_subscription boolean, _topup_credits integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT COALESCE(_admin,false) OR COALESCE(_paid_subscription,false) OR COALESCE(_topup_credits,0) >= 125 $$;
REVOKE ALL ON FUNCTION public.ai_payment_eligible(boolean,boolean,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ai_payment_eligible(boolean,boolean,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_generate_ai(_user uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE topup integer; paid_sub boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM _user THEN RAISE EXCEPTION 'forbidden'; END IF;
 SELECT COALESCE(max(g.amount),0) INTO topup FROM public.credit_ledger g
 WHERE g.user_id=_user AND g.reason='topup' AND g.amount>=125
 AND g.stripe_invoice_id IS NOT NULL AND g.livemode=public.stripe_livemode()
 AND NOT EXISTS (SELECT 1 FROM public.credit_ledger r WHERE r.user_id=_user AND r.stripe_invoice_id=g.stripe_invoice_id AND r.livemode=g.livemode AND r.reason IN ('refund_reversal','dispute_reversal') AND r.amount<0);
 paid_sub := public.has_active_subscription(_user) AND EXISTS (
 SELECT 1 FROM public.credit_ledger g WHERE g.user_id=_user AND g.reason='subscription' AND g.amount>0
 AND g.stripe_invoice_id IS NOT NULL AND g.livemode=public.stripe_livemode()
 AND (g.paid_net_pence>0 OR g.paid_net_pence IS NULL));
 RETURN public.ai_payment_eligible(public.has_role(_user,'admin'),paid_sub,topup);
END $$;
REVOKE ALL ON FUNCTION public.can_generate_ai(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_generate_ai(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.spend_credits(_user uuid, _amount integer, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE m text; b integer;
BEGIN
 IF _amount<=0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||_user::text));
 IF NOT public.can_generate_ai(_user) THEN RETURN 'payment_required'; END IF;
 IF public.has_role(_user,'admin') THEN
  SELECT mode,balance INTO m,b FROM public.admin_test_accounts WHERE user_id=_user;
  IF COALESCE(m,'admin')='admin' THEN RETURN 'admin'; END IF;
  IF b<_amount THEN RETURN 'insufficient'; END IF;
  UPDATE public.admin_test_accounts SET balance=balance-_amount,updated_at=now() WHERE user_id=_user;
  INSERT INTO public.admin_test_credit_log(user_id,amount,reason) VALUES(_user,-_amount,_reason);
  RETURN 'ok';
 END IF;
 IF public.credit_balance(_user)<_amount THEN RETURN 'insufficient'; END IF;
 INSERT INTO public.credit_ledger(user_id,amount,reason) VALUES(_user,-_amount,_reason);
 RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.spend_credits(uuid,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(uuid,integer,text) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_credit_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
 INSERT INTO public.credit_accounts(user_id,referral_code) VALUES(NEW.id,public.new_referral_code()) ON CONFLICT(user_id) DO NOTHING;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.claim_monthly_free_credits()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 0 $$;
CREATE OR REPLACE FUNCTION public.grant_monthly_free_credits_all()
RETURNS integer LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$ SELECT 0 $$;

CREATE OR REPLACE FUNCTION public.effective_account(_user uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE a boolean; m text; b integer; t text; eligible boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' AND auth.uid() IS DISTINCT FROM _user THEN RAISE EXCEPTION 'forbidden'; END IF;
 a := public.has_role(_user,'admin'); eligible := public.can_generate_ai(_user);
 IF a THEN SELECT mode,balance INTO m,b FROM public.admin_test_accounts WHERE user_id=_user; END IF;
 IF a AND COALESCE(m,'admin') <> 'admin' THEN RETURN jsonb_build_object('isAdmin',false,'adminAccess',true,'testMode',m,'tier',m,'pro',m<>'free','balance',b,'canGenerate',eligible); END IF;
 IF a THEN t:='pro'; ELSIF public.has_active_subscription(_user) THEN SELECT plan_tier INTO t FROM public.user_subscriptions WHERE user_id=_user AND livemode=public.stripe_livemode(); ELSE t:='free'; END IF;
 RETURN jsonb_build_object('isAdmin',a,'adminAccess',a,'testMode',null,'tier',t,'pro',a OR t<>'free','balance',public.credit_balance(_user),'canGenerate',eligible);
END $$;