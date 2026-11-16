import { describe, it, expect } from "vitest";
import { friendlyAutopilotError } from "./autopilot";

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
