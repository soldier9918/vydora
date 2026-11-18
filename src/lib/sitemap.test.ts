import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PUBLIC_PAGES } from "./seo";

const sitemap = readFileSync("public/sitemap.xml", "utf8");
const robots = readFileSync("public/robots.txt", "utf8");
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);

describe("sitemap and robots", () => {
  it("lists exactly the public pages on https://vydora.ai", () => {
    const expected = Object.keys(PUBLIC_PAGES).map((p) => `https://vydora.ai${p === "/" ? "/" : p}`).sort();
    expect([...locs].sort()).toEqual(expected);
  });
  it("has no duplicate URLs", () => expect(new Set(locs).size).toBe(locs.length));
  it("never lists private or admin pages", () => {
    for (const bad of ["/dashboard", "/my-videos", "/video/", "/library", "/create", "/autopilot", "/profile", "/billing", "/admin", "/auth"]) {
      expect(locs.some((l) => l.includes(bad))).toBe(false);
    }
  });
  it("robots does not block any public page and points to the sitemap", () => {
    const disallows = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map((m) => m[1]);
    for (const p of Object.keys(PUBLIC_PAGES)) expect(disallows.some((d) => p.startsWith(d))).toBe(false);
    expect(robots).toContain("Sitemap: https://vydora.ai/sitemap.xml");
  });
});
