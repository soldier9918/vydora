import { describe, it, expect } from "vitest";
import { CONVERSION_LABELS, GOOGLE_ADS_ID } from "./googleAds";
describe("Google Ads labels", () => {
  it("uses the single existing tag", () => expect(GOOGLE_ADS_ID).toBe("AW-17577433830"));
  it("sign-up label", () => expect(CONVERSION_LABELS.signup).toBe("9EjuCOba9b0dEOa1yb1B"));
  it("subscription label", () => expect(CONVERSION_LABELS.subscription).toBe("0j7MCOWt9r0dEOa1yb1B"));
  it("top-up label", () => expect(CONVERSION_LABELS.topup).toBe("15PPCJHd9b0dEOa1yb1B"));
});
