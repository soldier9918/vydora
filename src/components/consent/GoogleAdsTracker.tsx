import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { onConsentChange } from "@/lib/consent";
import { loadGoogleAds, reportConversion, purchasesFrom, isFreshAccount, type LedgerRow } from "@/lib/googleAds";

const CHECKOUT_KEY = "vydora-ads-checkout-return";

/** Loads the Google tag once consent allows and reports confirmed sign-ups and Stripe payments. */
export default function GoogleAdsTracker() {
  const { user } = useAuth();
  const { search } = useLocation();

  useEffect(() => {
    void loadGoogleAds();
    return onConsentChange(() => void loadGoogleAds());
  }, []);

  // Google sign-ups: count only an account created moments ago.
  useEffect(() => {
    if (user && isFreshAccount(user.created_at)) void reportConversion("signup", user.id);
  }, [user]);

  // Returning from Stripe Checkout: remember it, then wait for the webhook-confirmed ledger grant.
  useEffect(() => {
    if (new URLSearchParams(search).get("checkout") === "success") {
      try { sessionStorage.setItem(CHECKOUT_KEY, String(Date.now() - 60 * 60_000)); } catch { /* ignore */ }
    }
  }, [search]);

  useEffect(() => {
    if (!user) return;
    let since: number;
    try { since = Number(sessionStorage.getItem(CHECKOUT_KEY)); } catch { return; }
    if (!since) return;
    let stop = false;
    let tries = 0;
    const check = async () => {
      if (stop) return;
      const { data } = await supabase.from("credit_ledger")
        .select("reason, amount, stripe_invoice_id, created_at, livemode, paid_net_pence, billing_reason")
        .eq("user_id", user.id).in("reason", ["subscription", "topup"]).gt("amount", 0)
        .gte("created_at", new Date(since).toISOString()).limit(20);
      const found = purchasesFrom((data ?? []) as LedgerRow[], since);
      for (const p of found) await reportConversion(p.kind, p.id, { amount: p.value, currency: "GBP" });
      if (found.length) { try { sessionStorage.removeItem(CHECKOUT_KEY); } catch { /* ignore */ } return; }
      if (++tries < 12) setTimeout(check, 10_000);
    };
    void check();
    return () => { stop = true; };
  }, [user]);

  return null;
}
