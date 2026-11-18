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
