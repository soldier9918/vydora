import { expect, it } from "vitest";
import { STARTER_TOPUP_CREDITS, STARTER_TOPUP_GBP, STARTER_VIDEO_COSTS, STARTER_VIDEO_RANGE } from "./topUpPreview";

it("a £5 top-up buys 125 credits", () => {
  expect(STARTER_TOPUP_GBP).toBe(5);
  expect(STARTER_TOPUP_CREDITS).toBe(125);
});
it("125 credits cover three to four basic five-to-six-scene videos", () => {
  expect(STARTER_VIDEO_COSTS).toEqual([27, 32]);
  expect(STARTER_VIDEO_RANGE).toEqual({ min: 3, max: 4 });
});