import { describe, it, expect } from "vitest";
import { parseYouTubeVideo, isYouTubeChannel, filterGallery, safeChannelHref, checkEmbeddable, CONSENT_TEXT, type GalleryItem } from "./community";
import { readFileSync } from "node:fs";

const item = (o: Partial<GalleryItem>): GalleryItem => ({ id: "x", youtube_video_id: "dQw4w9WgXcQ", title: "T", description: "", category: "other",
  is_short: false, verified_vydora: false, featured: false, approved_at: "2026-11-01T00:00:00Z", creator_slug: "s", creator_name: "A",
  channel_name: "C", channel_url: "https://www.youtube.com/@abc", creator_bio: "", creator_avatar: null, ...o });

describe("YouTube URL validation", () => {
  it("accepts watch, short link, Shorts", () => {
    expect(parseYouTubeVideo("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.id).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideo("https://youtu.be/dQw4w9WgXcQ?t=3")?.id).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeVideo("https://youtube.com/shorts/dQw4w9WgXcQ")).toEqual({ id: "dQw4w9WgXcQ", isShort: true });
  });
  it("rejects lookalike hosts, http, bad ids and channel pages", () => {
    for (const u of ["https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ", "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/watch?v=short", "https://www.youtube.com/@abc", "javascript:alert(1)", "https://user@youtube.com/watch?v=dQw4w9WgXcQ"])
      expect(parseYouTubeVideo(u)).toBeNull();
  });
  it("channel links must be real YouTube channels", () => {
    expect(isYouTubeChannel("https://www.youtube.com/@cyberjungle")).toBe(true);
    expect(isYouTubeChannel("https://www.youtube.com/channel/UC1234567890123456789012")).toBe(true);
    expect(safeChannelHref("https://evil.com/@x")).toBeNull();
    expect(safeChannelHref("javascript:alert(1)")).toBeNull();
  });
  it("embed check fails closed for private or non-embeddable videos", async () => {
    const f = (async () => new Response("", { status: 401 })) as unknown as typeof fetch;
    expect((await checkEmbeddable("dQw4w9WgXcQ", f)).ok).toBe(false);
  });
});

describe("public gallery filtering", () => {
  const items = [item({ id: "a", category: "horror", title: "Haunted" }), item({ id: "b", featured: true, approved_at: "2026-10-01T00:00:00Z" }),
    item({ id: "c", approved_at: "2026-11-10T00:00:00Z" })];
  it("filters by category and search", () => {
    expect(filterGallery(items, { category: "horror" }).map((x) => x.id)).toEqual(["a"]);
    expect(filterGallery(items, { q: "haunt" }).map((x) => x.id)).toEqual(["a"]);
  });
  it("featured first by default, newest when asked", () => {
    expect(filterGallery(items, {})[0].id).toBe("b");
    expect(filterGallery(items, { sort: "newest" }).map((x) => x.id)).toEqual(["c", "a", "b"]);
  });
});

describe("server rules in the database migration", () => {
  const sql = readFileSync("drizzle/migrations/0059_community_showcase.sql", "utf8");
  it("public gallery shows only approved, non-withdrawn, consenting creators", () => {
    expect(sql).toMatch(/s\.status = 'approved' AND s\.withdrawn_at IS NULL AND c\.consent_withdrawn_at IS NULL/);
  });
  it("submitting requires consent, sign-in and blocks duplicates", () => {
    expect(sql).toContain("IF _consent IS NOT TRUE");
    expect(sql).toContain("IF me IS NULL THEN RAISE EXCEPTION 'Please sign in");
    expect(sql).toMatch(/UNIQUE INDEX community_one_live_per_video .* WHERE status IN \('pending','approved'\)/);
  });
  it("new submissions start pending, never auto-approved", () => {
    expect(sql).toContain("status text NOT NULL DEFAULT 'pending'");
  });
  it("withdraw only touches the caller's own rows; moderation requires admin", () => {
    expect(sql).toMatch(/WHERE id = _id AND user_id = auth\.uid\(\)/);
    expect(sql.match(/admin_community[\s\S]*?has_role\(auth\.uid\(\), 'admin'\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("public read never returns user ids or emails", () => {
    const fn = sql.slice(sql.indexOf("FUNCTION public.community_gallery"), sql.indexOf("GRANT EXECUTE ON FUNCTION public.community_gallery"));
    expect(fn).not.toMatch(/user_id uuid|email/);
  });
  it("consent text is the exact wording", () => expect(CONSENT_TEXT).toMatch(/^I confirm I own or have permission/));
});

describe("community page SEO", async () => {
  const { seoFor } = await import("./seo");
  const { bodyFor } = await import("../../prerender");
  it("/community is indexable with its own title and canonical", () => {
    const s = seoFor("/community");
    expect(s.title).toBe("Vydora Community Showcase | AI Videos Made by Creators");
    expect(s.canonical).toBe("https://vydora.ai/community");
    expect(s.robots).toBe("index, follow");
  });
  it("prerendered HTML has real content and no invented videos", () => {
    const html = bodyFor("/community");
    expect(html).toContain("<h1>Made with Vydora. Shared with the world.</h1>");
    expect(html.replace(/<[^>]+>/g, "").length).toBeGreaterThan(600);
    expect(html).not.toMatch(/youtube\.com\/watch|ytimg/);
  });
  it("private community pages are not indexable", () => {
    expect(seoFor("/community/me").robots).toContain("noindex");
    expect(seoFor("/community/creator/abc").robots).toContain("noindex");
  });
});

describe("YouTube connection required to submit", () => {
  it("server rejects submissions without a connected channel", () => {
    const sql = readFileSync("drizzle/migrations/0060_community_require_youtube_connection.sql", "utf8");
    expect(sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM youtube_connections WHERE user_id = me\) THEN RAISE EXCEPTION/);
  });
});
