import { describe, expect, it } from "vitest";
import { failureCsv, refundState } from "./exportFailureReport";
import { exportFailureMessage } from "../../supabase/functions/_shared/exportFailure";

describe("failure diagnostics", () => {
  it("retains a bounded reason for a failed export", () => {
    expect(exportFailureMessage("Encoder stopped")).toBe("Encoder stopped");
    expect(exportFailureMessage("x".repeat(2000))).toHaveLength(1000);
  });
  it("strips URLs and credentials from diagnostics", () => {
    const reason = exportFailureMessage("Failed https://example.test/file?token=secret Bearer private-token");
    expect(reason).not.toContain("secret");
    expect(reason).not.toContain("private-token");
  });
  it("handles absent and malformed failure reasons", () => {
    expect(exportFailureMessage(undefined)).toBe("Export failed; no reason was provided.");
    expect(exportFailureMessage({ token: "secret" })).not.toContain("secret");
  });
  it("does not claim a refund when no credits were charged", () => {
    expect(refundState({ credits_charged: 0, refunded: true })).toBe("not_charged");
  });
  it("distinguishes recorded refunds from unrecorded refunds", () => {
    expect(refundState({ credits_charged: 5, refunded: true })).toBe("recorded");
    expect(refundState({ credits_charged: 5, refunded: false })).toBe("not_recorded");
  });
  it("escapes CSV formulas and quotes", () => {
    expect(failureCsv([{ title: '=HYPERLINK("bad")' }])).toContain(`"'=HYPERLINK(""bad"")"`);
    expect(failureCsv([{ title: "  =1+1" }])).toContain("'  =1+1");
  });
});