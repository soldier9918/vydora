// Credit prices for each AI action. Browser-only features are free; video exports and downloads are free.
export const CREDIT_COSTS = {
  script: 2,
  facts: 2,
  image: 3,
  voice: 2,
  animate: 25,
  thumbnail: 5,
  seo: 1,
  webCapture: 5,
} as const;

/** Scenes that show the real website in an automatic product ad (reveal, features, final call to action). Must match _shared/credits.ts. */
export function websiteScenes(count: number): number[] {
  if (count < 4) return [count - 1].filter((n) => n >= 0);
  return [...new Set([Math.round(count * 0.3), Math.round(count * 0.5), Math.round(count * 0.65), count - 1])].sort((a, b) => a - b);
}

export type EstimateInput = {
  scenes: number;
  useFacts?: boolean;
  animated?: number;
  thumbnail?: boolean;
  seo?: boolean;
  quality?: string;
  websiteScenes?: number;
};

export type CostLine = { label: string; credits: number };

export function costBreakdown(i: EstimateInput): CostLine[] {
  const c = CREDIT_COSTS;
  const lines: CostLine[] = [{ label: "Script", credits: c.script }];
  if (i.useFacts) lines.push({ label: "Real-facts web search", credits: c.facts });
  lines.push({ label: `${i.scenes} scene images`, credits: i.scenes * c.image });
  lines.push({ label: `${i.scenes} voiceovers`, credits: i.scenes * c.voice });
  if (i.websiteScenes) lines.push({ label: `${i.websiteScenes} real website scenes`, credits: i.websiteScenes * c.webCapture });
  if (i.animated) lines.push({ label: `${i.animated} animated scenes`, credits: i.animated * c.animate });
  if (i.thumbnail) lines.push({ label: "Thumbnail", credits: c.thumbnail });
  if (i.seo) lines.push({ label: "Title, description & tags", credits: c.seo });
  return lines;
}

export function estimateCredits(i: EstimateInput): number {
  return costBreakdown(i).reduce((n, l) => n + l.credits, 0);
}
