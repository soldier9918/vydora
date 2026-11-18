import { GUIDES, type Guide } from "./guides";

/** Guides that help with each feature page (feature slug -> guide slugs). */
export const FEATURE_GUIDES: Record<string, string[]> = {
  "faceless-youtube-channel": ["best-faceless-youtube-niches", "youtube-monetization-faceless-ai-channels"],
  "article-to-video": ["turn-blog-posts-into-youtube-videos"],
  "youtube-shorts-maker": ["youtube-shorts-hooks"],
  "text-to-video": ["best-faceless-youtube-niches", "turn-blog-posts-into-youtube-videos"],
  "youtube-series-generator": ["how-to-plan-a-youtube-series"],
  "history-documentary-video-maker": ["best-faceless-youtube-niches", "how-to-plan-a-youtube-series"],
  "youtube-autopilot": ["automate-youtube-channel-with-ai"],
  "ai-product-ads": ["ai-product-video-ads"],
  "ai-voiceover-video-maker": ["youtube-monetization-faceless-ai-channels"],
  "ai-story-video-generator": ["best-faceless-youtube-niches", "youtube-shorts-hooks"],
};

export const guidesForFeature = (slug: string): Guide[] =>
  (FEATURE_GUIDES[slug] ?? []).map((s) => GUIDES.find((g) => g.slug === s)).filter((g): g is Guide => !!g);
