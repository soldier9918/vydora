import { describe, it, expect } from "vitest";
import { estimateCredits, websiteScenes } from "./credits";

describe("automatic website capture", () => {
  it("a 16-scene ad shows the real website on 4 scenes", () => {
    expect(websiteScenes(16)).toEqual([5, 8, 10, 15]);
  });
  it("adds 5 credits per website scene (16-scene ad with link: 84 -> 104)", () => {
    expect(estimateCredits({ scenes: 16, useFacts: true })).toBe(84);
    expect(estimateCredits({ scenes: 16, useFacts: true, websiteScenes: 4 })).toBe(104);
  });
});
