import { describe, it, expect } from "vitest";
import { friendlyAutopilotError, autopilotLengthOk, AUTOPILOT_MAX_SECONDS } from "./autopilot";

describe("autopilot customer messages", () => {
  it("explains low credits with nothing charged", () => {
    expect(friendlyAutopilotError("Skipped: not enough credits. Top up and press Retry.")).toMatch(/Nothing was charged/);
  });
  it("explains the subscription requirement", () => {
    expect(friendlyAutopilotError("Skipped: automatic making needs an active Creator or Pro plan.")).toMatch(/Creator or Pro/);
  });
  it("explains the 3-attempt limit and refunds", () => {
    expect(friendlyAutopilotError("Stopped after 3 failed attempts: timeout")).toMatch(/3 times.*refunded/);
  });
  it("returns nothing when there is no error", () => {
    expect(friendlyAutopilotError(null)).toBeNull();
  });
});

describe("autopilot 20 Minute cap", () => {
  it("is 20 Minutes", () => expect(AUTOPILOT_MAX_SECONDS).toBe(1200));
  it("allows exactly 20 Minutes", () => expect(autopilotLengthOk(1200)).toBe(true));
  it("blocks anything longer", () => expect(autopilotLengthOk(1201)).toBe(false));
});
