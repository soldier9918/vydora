// Estimated Lovable credits per paid action, measured from 30 days of recorded
// usage (27 Oct – 25 Nov 2026). Estimates only — real billing lives in Lovable.
export const COST_PER_ACTION: Record<string, number> = {
  scene_image: 0.045,
  scene_voice: 0.0625,
  video_script: 0.52,
  animate_scene: 2,
  thumbnail: 0.045,
  seo: 0.1,
  scene_extend: 0.0625,
  video_export: 0,
  web_recording: 0.05,
};
export const DEFAULT_ACTION_COST = 0.1;

// Running costs that don't depend on one user (Lovable credits per 30 days).
export const FIXED_MONTHLY = { Database: 20.4, "Visitor traffic": 12.6, "Background tasks": 1.3 };

export const ACTION_LABELS: Record<string, string> = {
  scene_image: "Scene pictures", scene_voice: "Voiceovers", video_script: "Scripts",
  animate_scene: "Scene animations", thumbnail: "Thumbnail images", seo: "Title, description and tags",
  scene_extend: "Scene extensions", video_export: "Exports", web_recording: "Website recordings",
};

export type UsageRow = { action: string; tier: "free" | "paid" | "admin"; n: number; credits: number };

export const actionCost = (r: Pick<UsageRow, "action" | "n">) =>
  r.n * (COST_PER_ACTION[r.action] ?? DEFAULT_ACTION_COST);

export function totalsByTier(rows: UsageRow[]) {
  const t = { free: 0, paid: 0, admin: 0 };
  for (const r of rows) t[r.tier] += actionCost(r);
  return t;
}

export const fixedFor = (days: number) =>
  (Object.values(FIXED_MONTHLY).reduce((a, b) => a + b, 0) * days) / 30;
