import { describe, it, expect } from "vitest";
import fs from "fs";
import { htmlFor } from "../../prerender";
import { PUBLIC_PAGES } from "./seo";

const tpl = fs.readFileSync("index.html", "utf8");
const routes = Object.keys(PUBLIC_PAGES);

describe("prerendered public pages", () => {
  it("each page gets its own title, canonical and one h1", () => {
    const titles = new Set<string>();
    for (const r of routes) {
      const h = htmlFor(tpl, r);
      const title = h.match(/<title>(.*?)<\/title>/)![1];
      titles.add(title);
      expect(h).toContain(`<link rel="canonical" href="https://vydora.ai${r === "/" ? "/" : r}"`);
      expect(h.match(/<h1>/g)?.length).toBe(1);
    }
    expect(titles.size).toBe(routes.length);
  });
  it("guides carry Article data", () => {
    expect(htmlFor(tpl, "/guides/youtube-monetization-faceless-ai-channels")).toContain('"@type":"Article"');
  });
});

import { readFileSync as readTpl } from "node:fs";
import { htmlFor as htmlForLd } from "../../prerender";
import { GUIDES as GUIDES_LD } from "./guides";
const ldOf = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

describe("structured data", () => {
  const tpl = readTpl("index.html", "utf8");
  it("site data uses real GBP plan prices and no ratings or reviews", () => {
    const [site] = ldOf(tpl);
    const app = site["@graph"].find((n: any) => n["@type"] === "SoftwareApplication");
    expect(app.offers.map((o: any) => [o.name, o.price, o.priceCurrency])).toEqual([["Free", "0", "GBP"], ["Creator", "19", "GBP"], ["Pro", "49", "GBP"]]);
    expect(tpl).not.toMatch(/aggregateRating|"review"|FAQPage/);
  });
  it("guides get an Article with headline and publisher", () => {
    const g = GUIDES_LD[0];
    const art = ldOf(htmlForLd(tpl, `/guides/${g.slug}`)).find((x) => x["@type"] === "Article");
    expect(art.headline).toBe(g.h1);
    expect(art.publisher.name).toBe("Vydora");
  });
});

describe("canonical addresses", () => {
  const tpl = readTpl("index.html", "utf8");
  it("each public page points to its own https://vydora.ai address without a trailing slash", () => {
    for (const r of ["/pricing", "/text-to-video", "/guides"]) {
      expect(htmlForLd(tpl, r)).toContain(`<link rel="canonical" href="https://vydora.ai${r}" />`);
    }
    expect(htmlForLd(tpl, "/")).toContain('<link rel="canonical" href="https://vydora.ai/" />');
  });
});

describe("social sharing", () => {
  const tpl = readTpl("index.html", "utf8");
  it("every page shares the branded image, its own address and title", () => {
    const html = htmlForLd(tpl, "/text-to-video");
    expect(html).toContain('<meta property="og:image" content="https://vydora.ai/og-image.jpg" />');
    expect(html).toContain('<meta property="og:url" content="https://vydora.ai/text-to-video" />');
    expect(html).toMatch(/<meta name="twitter:title" content="[^"]*Vydora" \/>/);
  });
  it("guides share as articles, other pages as websites", () => {
    expect(htmlForLd(tpl, `/guides/${GUIDES_LD[0].slug}`)).toContain('og:type" content="article"');
    expect(htmlForLd(tpl, "/pricing")).toContain('og:type" content="website"');
  });
});

describe("indexing problem pages", () => {
  const t = readTpl("index.html", "utf8");
  for (const r of ["/faceless-youtube-channel", "/text-to-video", "/youtube-autopilot", "/guides", "/history-documentary-video-maker"]) {
    it(`${r} serves its own head and content, not the homepage`, () => {
      const h = htmlForLd(t, r);
      expect(h).toContain(`<link rel="canonical" href="https://vydora.ai${r}"`);
      expect(h).not.toContain("<title>AI YouTube Video Generator & Faceless Video Maker | Vydora</title>");
      expect(h).not.toMatch(/noindex/);
      expect(h.match(/<div id="root">([\s\S]*?)<\/main><\/div>/)![1].length).toBeGreaterThan(1200);
    });
  }
  it("/guides links to every article", () => {
    const h = htmlForLd(t, "/guides");
    for (const g of GUIDES_LD) expect(h).toContain(`href="/guides/${g.slug}"`);
  });
});
