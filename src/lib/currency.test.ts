import { describe, expect, it } from "vitest";
import { CURRENCIES, convertedAmount, isCurrency, parseRates } from "./currency";

const data = { base: "GBP", date: "2026-11-24", rates: { USD: 1.25, EUR: 1.15, CAD: 1.75, AUD: 1.9, INR: 110 } };
const rates = parseRates(data);

describe("display-only currency conversion", () => {
  it("supports GBP plus the five chosen currencies", () => expect(CURRENCIES).toEqual(["GBP", "USD", "EUR", "CAD", "AUD", "INR"]));
  it("converts Creator £19 using the supplied rate", () => expect(convertedAmount(19, "USD", rates)).toBe(23.75));
  it("converts Pro £49 using the supplied rate", () => expect(convertedAmount(49, "EUR", rates)).toBe(56.35));
  it("converts a £5 top-up without changing its GBP amount", () => expect(convertedAmount(5, "INR", rates)).toBe(550));
  it("keeps GBP independent of rates", () => expect(convertedAmount(19, "GBP")).toBe(19));
  it("converts free prices to zero", () => expect(convertedAmount(0, "AUD", rates)).toBe(0));
  it("does not invent rates when unavailable", () => expect(convertedAmount(49, "CAD")).toBeNull());
  it("rejects invalid stored currency preferences", () => expect(isCurrency("BTC")).toBe(false));
  it("rejects incomplete rates", () => expect(() => parseRates({ ...data, rates: { USD: 1.25 } })).toThrow());
  it("rejects an incorrect base currency", () => expect(() => parseRates({ ...data, base: "USD" })).toThrow());
  it("rejects nonpositive rates", () => expect(() => parseRates({ ...data, rates: { ...data.rates, INR: 0 } })).toThrow());
  it("rounds conversions to two decimal places", () => expect(convertedAmount(5.55, "USD", rates)).toBe(6.94));
});