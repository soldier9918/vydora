import { describe, it, expect } from "vitest";
import { purchasesFrom, isFreshAccount, GOOGLE_ADS_ID, CONVERSION_LABELS } from "./googleAds";

const since = Date.parse("2026-11-23T12:00:00Z");
const row = (o: Partial<Parameters<typeof purchasesFrom>[0][0]>) => ({
  reason: "topup", amount: 250, stripe_invoice_id: "in_1", created_at: "2026-11-23T12:01:00Z", livemode: true, ...o,
});

describe("Google Ads conversions", () => {
  it("uses the Vydora tag id", () => expect(GOOGLE_ADS_ID).toBe("AW-17577433830"));
  it("has no invented labels", () => expect(Object.values(CONVERSION_LABELS).every((l) => l === "")).toBe(true));
  it("reports a £10 top-up with its Stripe invoice id", () =>
    expect(purchasesFrom([row({})], since)).toEqual([{ kind: "topup", id: "in_1", value: 10 }]));
  it("values Creator at £19 and Pro at £49", () => {
    expect(purchasesFrom([row({ reason: "subscription", amount: 600 })], since)[0].value).toBe(19);
    expect(purchasesFrom([row({ reason: "subscription", amount: 2000 })], since)[0].value).toBe(49);
  });
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
