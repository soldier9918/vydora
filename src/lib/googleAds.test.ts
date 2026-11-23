import { describe, it, expect } from "vitest";
import { purchasesFrom, isFreshAccount, GOOGLE_ADS_ID, CONVERSION_LABELS } from "./googleAds";

const since = Date.parse("2026-11-23T12:00:00Z");
const row = (o: Partial<Parameters<typeof purchasesFrom>[0][0]>) => ({
  reason: "topup", amount: 250, stripe_invoice_id: "in_1", created_at: "2026-11-23T12:01:00Z", livemode: true, ...o,
});

describe("Google Ads conversions", () => {
  it("uses the Vydora tag id", () => expect(GOOGLE_ADS_ID).toBe("AW-17577433830"));
  it("reports a £10 top-up with its Stripe invoice id", () =>
    expect(purchasesFrom([row({})], since)).toEqual([{ kind: "topup", id: "in_1", value: 10 }]));
  const sub = (o: object) => row({ reason: "subscription", amount: 600, billing_reason: "subscription_create", ...o });
  it("reports a full-price Creator payment as £19", () =>
    expect(purchasesFrom([sub({ paid_net_pence: 1900 })], since)).toEqual([{ kind: "subscription", id: "in_1", value: 19 }]));
  it("reports a discounted Pro payment at the £24.50 actually paid, not £49", () =>
    expect(purchasesFrom([sub({ amount: 2000, paid_net_pence: 2450 })], since)[0].value).toBe(24.5));
  it("never reports a £0 trial or unvalued payment", () =>
    expect(purchasesFrom([sub({ paid_net_pence: 0 }), sub({ paid_net_pence: null, stripe_invoice_id: "in_2" })], since)).toEqual([]));
  it("never reports renewals or plan changes", () =>
    expect(purchasesFrom([sub({ paid_net_pence: 1900, billing_reason: "subscription_cycle" }), sub({ paid_net_pence: 3000, billing_reason: "subscription_update", stripe_invoice_id: "in_3" })], since)).toEqual([]));
  it("reports a repeated invoice only once", () =>
    expect(purchasesFrom([sub({ paid_net_pence: 1900 }), sub({ paid_net_pence: 1900 })], since)).toHaveLength(1));
  it("ignores test-mode, older, refund and non-Stripe rows", () => {
    expect(purchasesFrom([
      row({ livemode: false }), row({ created_at: "2026-11-23T11:00:00Z" }),
      row({ reason: "refund_reversal", amount: -250 }), row({ stripe_invoice_id: null }), row({ reason: "monthly_free" }),
    ], since)).toEqual([]);
  });
  it("counts only accounts created in the last 10 minutes", () => {
    const now = Date.parse("2026-11-23T12:10:00Z");
    expect(isFreshAccount("2026-11-23T12:05:00Z", now)).toBe(true);
    expect(isFreshAccount("2026-11-20T12:05:00Z", now)).toBe(false);
  });
});
