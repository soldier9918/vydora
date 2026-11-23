import { describe, it, expect } from "vitest";
import { paidNetPence } from "../../supabase/functions/_shared/paidValue";
describe("Stripe paid value", () => {
  it("full price £19 with no tax", () => expect(paidNetPence({ amount_paid: 1900, currency: "gbp" })).toBe(1900));
  it("discount: £9.50 paid after a 50% coupon", () => expect(paidNetPence({ amount_paid: 950, currency: "gbp" })).toBe(950));
  it("removes itemised VAT: £22.80 paid incl £3.80 VAT is £19", () =>
    expect(paidNetPence({ amount_paid: 2280, currency: "gbp", total_taxes: [{ amount: 380 }] })).toBe(1900));
  it("removes VAT from the older tax field", () => expect(paidNetPence({ amount_paid: 5880, currency: "gbp", tax: 980 })).toBe(4900));
  it("zero-payment invoice is £0", () => expect(paidNetPence({ amount_paid: 0, currency: "gbp" })).toBe(0));
  it("non-GBP is not valued", () => expect(paidNetPence({ amount_paid: 1900, currency: "usd" })).toBeNull());
});
