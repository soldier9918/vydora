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
