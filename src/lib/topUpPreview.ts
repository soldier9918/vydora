import { estimateCredits } from "./credits";

export const STARTER_TOPUP_GBP = 5;
export const STARTER_TOPUP_CREDITS = STARTER_TOPUP_GBP * 25;
export const STARTER_VIDEO_COSTS = [5, 6].map((scenes) => estimateCredits({ scenes }));
export const STARTER_VIDEO_RANGE = {
  min: Math.floor(STARTER_TOPUP_CREDITS / Math.max(...STARTER_VIDEO_COSTS)),
  max: Math.floor(STARTER_TOPUP_CREDITS / Math.min(...STARTER_VIDEO_COSTS)),
};