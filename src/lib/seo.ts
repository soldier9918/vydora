import { FEATURE_PAGES } from "./featurePages";
import { GUIDES } from "./guides";

export const SITE = "https://vydora.ai";

export const INDEPENDENCE_DISCLAIMER = "YouTube is a trademark of Google LLC. Vydora is an independent AI video creation platform and is not affiliated with, endorsed by, or sponsored by Google or YouTube.";

/** Sign-in page: not indexed, but links followed. Not in PUBLIC_PAGES so it stays out of the sitemap. */
export const AUTH_PAGE = { title: "Sign In or Create Account | Vydora", description: "Sign in to your Vydora account, or create a free one, to make AI videos. Vydora is an independent video creation platform." };

export const PUBLIC_PAGES: Record<string, { title: string; description: string }> = {
  "/": { title: "AI YouTube Video Generator & Faceless Video Maker | Vydora", description: "Create YouTube videos with AI. Vydora writes scripts, makes scene visuals and records voiceovers. AI generation starts with a £5 top-up or subscription." },
  "/pricing": { title: "Pricing & Plans – AI YouTube Video Maker | Vydora", description: "AI generation starts with a £5 top-up or subscription. Compare Creator £19/month with 600 credits and Pro £49/month with 2,000 credits. No free AI generations." },
  "/feedback": { title: "Send Feedback | Vydora", description: "Tell the Vydora team what you love, what's broken, or what the AI video maker should do next." },
  "/privacy": { title: "Privacy Policy | Vydora", description: "What Vydora collects, how it is used and how your private video files are kept safe." },
  "/terms": { title: "Terms of Service | Vydora", description: "The terms you agree to when you use Vydora, the AI YouTube video maker, including plans, credits and your content." },
  "/cookies": { title: "Cookie Policy | Vydora", description: "The essential sign-in and preference storage Vydora uses. No advertising cookies." },
  "/refund": { title: "Refund Policy | Vydora", description: "When you can get a refund for Vydora subscriptions and credits." },
  "/disclaimer": { title: "Disclaimer | Vydora", description: "What Vydora's AI-generated videos do and do not promise." },
  "/acceptable-use": { title: "Acceptable Use Policy | Vydora", description: "The content rules for Vydora: what you must not create or publish with the AI YouTube video maker." },
  "/community": { title: "Vydora Community Showcase | AI Videos Made by Creators", description: "Explore AI videos created by the Vydora community, discover talented YouTubers, and share your own creations." },
  "/guides": { title: "Free YouTube Creator Guides | Vydora", description: "Free guides on faceless niches, YouTube monetisation, Shorts hooks, repurposing blog posts and planning a series." },
  ...Object.fromEntries(GUIDES.map((g) => [`/guides/${g.slug}`, { title: g.title, description: g.description }])),
  ...Object.fromEntries(FEATURE_PAGES.map((p) => [`/${p.slug}`, { title: p.title, description: p.description }])),
};

export function seoFor(pathname: string) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const page = PUBLIC_PAGES[path];
  if (page) return { ...page, canonical: SITE + (path === "/" ? "/" : path), index: true, robots: "index, follow" };
  if (path === "/auth") return { ...AUTH_PAGE, canonical: null, index: false, robots: "noindex, follow" };
  return { title: "Vydora", description: PUBLIC_PAGES["/"].description, canonical: null, index: false, robots: "noindex, nofollow" };
}
