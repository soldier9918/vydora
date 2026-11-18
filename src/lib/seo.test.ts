import { describe, it, expect } from "vitest";
import { seoFor } from "./seo";
describe("seo", () => {
  it("private pages are noindex", () => {
    for (const p of ["/dashboard", "/admin-kb20", "/billing", "/auth", "/video/abc", "/library", "/nope"]) expect(seoFor(p).index).toBe(false);
  });
  it("public pages are indexed with self canonical", () => {
    expect(seoFor("/pricing")).toMatchObject({ index: true, canonical: "https://vydora.ai/pricing" });
    expect(seoFor("/article-to-video")).toMatchObject({ index: true, canonical: "https://vydora.ai/article-to-video" });
    expect(seoFor("/").canonical).toBe("https://vydora.ai/");
  });
});

import { PUBLIC_PAGES as ALL } from "./seo";
describe("unique page metadata", () => {
  it("no two public pages share a title or description, and all are Vydora-branded", () => {
    const v = Object.values(ALL);
    expect(new Set(v.map((p) => p.title)).size).toBe(v.length);
    expect(new Set(v.map((p) => p.description)).size).toBe(v.length);
    for (const p of v) expect(p.title).toMatch(/Vydora/);
  });
});
