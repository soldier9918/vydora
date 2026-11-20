// Community Showcase helpers: YouTube link parsing, categories, consent text, safe public filters.
export const COMMUNITY_CATEGORIES = [
  { id: "horror", label: "Horror & Mystery", short: "Horror" },
  { id: "history", label: "History & Documentaries", short: "History" },
  { id: "education", label: "Education", short: "Education" },
  { id: "science", label: "Science & Technology", short: "Science" },
  { id: "storytelling", label: "Storytelling", short: "Stories" },
  { id: "finance", label: "Finance & Business", short: "Finance" },
  { id: "shorts", label: "YouTube Shorts", short: "Shorts" },
  { id: "entertainment", label: "Entertainment", short: "Entertainment" },
  { id: "other", label: "Other", short: "Other" },
] as const;
export type CommunityCategory = (typeof COMMUNITY_CATEGORIES)[number]["id"];
export const categoryLabel = (id: string) => COMMUNITY_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";

export const CONSENT_TEXT = "I confirm I own or have permission to showcase this video and its associated channel information. I give Vydora permission to display the video, thumbnail, title and creator information in the public Community Showcase. I understand I can request removal at any time.";

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const ID = /^[A-Za-z0-9_-]{11}$/;

/** Returns the 11-character video id for a real YouTube video link, else null. */
export function parseYouTubeVideo(input: string): { id: string; isShort: boolean } | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (u.protocol !== "https:" || !YT_HOSTS.has(u.hostname.toLowerCase()) || u.username || u.password || u.port) return null;
  const host = u.hostname.toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  let id: string | null = null; let isShort = false;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (u.pathname === "/watch") id = u.searchParams.get("v");
  else if (parts[0] === "shorts" || parts[0] === "live" || parts[0] === "embed") { id = parts[1] ?? null; isShort = parts[0] === "shorts"; }
  return id && ID.test(id) ? { id, isShort } : null;
}

export const CHANNEL_RE = /^https:\/\/(www\.|m\.)?youtube\.com\/(@[A-Za-z0-9._-]{3,100}|channel\/UC[A-Za-z0-9_-]{22}|c\/[A-Za-z0-9._-]{1,100})\/?$/;
export const isYouTubeChannel = (url: string) => CHANNEL_RE.test(url.trim());

export const thumbUrl = (id: string) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;
export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

/** Asks YouTube's public oEmbed whether the video is public and embeddable. */
export async function checkEmbeddable(id: string, f: typeof fetch = fetch): Promise<{ ok: boolean; title?: string; author?: string; authorUrl?: string }> {
  try {
    const r = await f(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl(id))}`);
    if (!r.ok) return { ok: false };
    const j = await r.json();
    return { ok: true, title: j.title, author: j.author_name, authorUrl: j.author_url };
  } catch { return { ok: false }; }
}

export type GalleryItem = {
  id: string; youtube_video_id: string; title: string; description: string; category: string; is_short: boolean;
  verified_vydora: boolean; featured: boolean; approved_at: string | null; creator_slug: string; creator_name: string | null;
  channel_name: string; channel_url: string; creator_bio: string; creator_avatar: string | null;
};

export function filterGallery(items: GalleryItem[], opts: { q?: string; category?: string; sort?: "featured" | "newest" }) {
  const q = (opts.q ?? "").trim().toLowerCase();
  const out = items.filter((v) => (!opts.category || opts.category === "all" || v.category === opts.category) &&
    (!q || [v.title, v.description, v.creator_name ?? "", v.channel_name].some((t) => t.toLowerCase().includes(q))));
  const t = (v: GalleryItem) => (v.approved_at ? Date.parse(v.approved_at) : 0);
  return out.sort((a, b) => (opts.sort === "newest" ? 0 : Number(b.featured) - Number(a.featured)) || t(b) - t(a));
}

/** Only https links to YouTube channels are ever rendered as channel buttons. */
export const safeChannelHref = (url: string) => (isYouTubeChannel(url) ? url : null);
