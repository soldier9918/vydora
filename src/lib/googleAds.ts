import { permitsOrdinaryAds, updateGoogleAdConsent } from "./ad-consent";
import { poundsFor } from "./paymentValue";

/** Google Ads tag for vydora.ai. */
export const GOOGLE_ADS_ID = "AW-17577433830";

/**
 * Conversion labels copied from Google Ads (Goals → Conversions → action → Tag setup).
 * Leave empty until the action exists; empty labels send nothing.
 */
export const CONVERSION_LABELS = {
  signup: "",
  subscription: "",
  topup: "",
} as const;

export type ConversionKind = keyof typeof CONVERSION_LABELS;

const REPORTED_KEY = "vydora-ads-reported";

export async function loadGoogleAds(): Promise<boolean> {
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
  const allowed = await permitsOrdinaryAds();
  if (!allowed) return false; // basic route: no Google request until advertising is accepted
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  updateGoogleAdConsent("granted");
  if (document.querySelector("script[data-google-ads]")) return true;
  window.gtag("set", "developer_id.dZjgwMW", true);
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
  const script = document.createElement("script");
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GOOGLE_ADS_ID);
  script.async = true;
  script.dataset["googleAds"] = "";
  document.head.appendChild(script);
  return true;
}

function reported(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(REPORTED_KEY) ?? "[]")); } catch { return new Set(); }
}
export function alreadyReported(id: string): boolean { return reported().has(id); }
function markReported(id: string) {
  const s = reported(); s.add(id);
  try { localStorage.setItem(REPORTED_KEY, JSON.stringify([...s].slice(-200))); } catch { /* ignore */ }
}

/** Sends one conversion, at most once per transaction id, only with advertising consent and a real label. */
export async function reportConversion(kind: ConversionKind, transactionId: string, value?: { amount: number; currency: string }) {
  const label = CONVERSION_LABELS[kind];
  const key = `${kind}:${transactionId}`;
  if (!label || alreadyReported(key)) return false;
  if (!(await loadGoogleAds()) || !(await permitsOrdinaryAds())) return false;
  window.gtag?.("event", "conversion", {
    send_to: `${GOOGLE_ADS_ID}/${label}`,
    transaction_id: transactionId,
    ...(value ? { value: value.amount, currency: value.currency } : {}),
  });
  markReported(key);
  return true;
}

export type LedgerRow = { reason: string; amount: number; stripe_invoice_id: string | null; created_at: string; livemode: boolean | null };
export type PurchaseConversion = { kind: "subscription" | "topup"; id: string; value: number };

/** Confirmed paid ledger grants (written only by the Stripe webhook) created after checkout started. */
export function purchasesFrom(rows: LedgerRow[], sinceMs: number): PurchaseConversion[] {
  return rows
    .filter((r) => (r.reason === "subscription" || r.reason === "topup") && r.amount > 0 && !!r.stripe_invoice_id
      && r.livemode === true && Date.parse(r.created_at) >= sinceMs)
    .map((r) => ({ kind: r.reason as "subscription" | "topup", id: r.stripe_invoice_id!, value: poundsFor(r.reason, r.amount) }));
}

/** A Google sign-in counts as a registration only when the account was created moments ago. */
export function isFreshAccount(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const age = now - Date.parse(createdAt);
  return age >= 0 && age < 10 * 60_000;
}
