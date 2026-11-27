CREATE TABLE public.ai_credit_requests(user_id uuid NOT NULL, request_key text NOT NULL, amount integer NOT NULL CHECK(amount>0), reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_key));
GRANT ALL ON public.ai_credit_requests TO service_role;
ALTER TABLE public.ai_credit_requests ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reserve_ai_credits(_user uuid,_amount integer,_reason text,_request_key text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result text;
BEGIN
 IF _request_key IS NULL OR length(_request_key)>200 OR length(_request_key)<1 THEN RAISE EXCEPTION 'Invalid request key'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('credits:'||_user::text));
 IF EXISTS(SELECT 1 FROM public.ai_credit_requests WHERE user_id=_user AND request_key=_request_key) THEN RETURN 'duplicate'; END IF;
 result:=public.spend_credits(_user,_amount,_reason);
 IF result IN ('ok','admin') THEN INSERT INTO public.ai_credit_requests(user_id,request_key,amount,reason) VALUES(_user,_request_key,_amount,_reason); END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.reserve_ai_credits(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_credits(uuid,integer,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.claim_referral(_code text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE me uuid:=auth.uid(); acct public.credit_accounts; ref uuid;
BEGIN
 IF me IS NULL THEN RETURN 'not_signed_in'; END IF;
 SELECT * INTO acct FROM public.credit_accounts WHERE user_id=me FOR UPDATE;
 IF acct IS NULL THEN RETURN 'no_account'; END IF;
 IF acct.referred_by IS NOT NULL THEN RETURN 'already_claimed'; END IF;
 IF acct.created_at<now()-interval '7 days' THEN RETURN 'too_late'; END IF;
 SELECT user_id INTO ref FROM public.credit_accounts WHERE referral_code=upper(trim(_code));
 IF ref IS NULL THEN RETURN 'invalid'; END IF;
 IF ref=me THEN RETURN 'own_code'; END IF;
 UPDATE public.credit_accounts SET referred_by=ref WHERE user_id=me;
 RETURN 'ok';
END $$;

CREATE OR REPLACE FUNCTION public.free_credit_removal_amount(_balance bigint,_free bigint,_mixed boolean,_protected boolean) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN COALESCE(_mixed,true) OR COALESCE(_protected,true) OR _balance>_free THEN 0 ELSE GREATEST(LEAST(COALESCE(_balance,0),COALESCE(_free,0)),0) END::bigint
$$;
REVOKE ALL ON FUNCTION public.free_credit_removal_amount(bigint,bigint,boolean,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.free_credit_removal_amount(bigint,bigint,boolean,boolean) TO authenticated,service_role;