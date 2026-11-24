import { describe, it, expect } from "vitest";
import { estimateCredits } from "./credits";

describe("full video cost", () => {
  it("6 scenes costs 32 credits, more than the 30 Free credits", () => {
    expect(estimateCredits({ scenes: 6 })).toBe(32);
  });
  it("the 5-scene default (27 credits) fits within 30 Free credits", () => {
    expect(estimateCredits({ scenes: 5 })).toBeLessThanOrEqual(30);
  });
});
