import { describe, it, expect } from "vitest";
import { actionCost, totalsByTier, fixedFor } from "./usageCosts";

describe("usage cost estimates", () => {
  it("prices 10 scene pictures at 0.45 credits", () => {
    expect(actionCost({ action: "scene_image", n: 10 })).toBeCloseTo(0.45);
  });
  it("splits costs between Free and paid users", () => {
    const t = totalsByTier([
      { action: "video_script", tier: "free", n: 2, credits: 4 },
      { action: "scene_voice", tier: "paid", n: 4, credits: 8 },
    ]);
    expect(t.free).toBeCloseTo(1.04);
    expect(t.paid).toBeCloseTo(0.25);
  });
  it("scales fixed running costs to the period", () => {
    expect(fixedFor(15)).toBeCloseTo(17.15);
  });
});
