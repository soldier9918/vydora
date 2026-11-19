/** How a video is filed in My videos. */
export type Kind = "normal" | "article" | "ad" | "series" | "autopilot";

export const KIND_GROUPS: { kind: Kind; label: string }[] = [
  { kind: "normal", label: "Videos" },
  { kind: "article", label: "Article to video" },
  { kind: "ad", label: "Product Ad" },
  { kind: "series", label: "Series" },
  { kind: "autopilot", label: "Autopilot" },
];

export const KIND_LABELS: Record<Kind, string> = {
  normal: "Standard video",
  article: "Article to video",
  ad: "Product Ad",
  series: "Series",
  autopilot: "Autopilot",
};

/**
 * Files a video into one category.
 * - `kind = "ad"` is written by the script generator for Product Ads, so an ad that
 *   carries a product link still counts as an ad, not an article.
 * - Series episodes are titled "<Series> [Part n/N]: ..." by the Series page; articles keep their link.
 * - Autopilot videos are known from the plan that made them.
 */
export function videoKind(
  v: { id: string; title: string; source_url?: string | null; kind?: string | null },
  autopilotIds?: Set<string>,
): Kind {
  if (v.kind === "ad") return "ad";
  if (/\[Part \d+\/\d+\]/.test(v.title)) return "series";
  if (v.source_url) return "article";
  if (autopilotIds?.has(v.id)) return "autopilot";
  return "normal";
}
