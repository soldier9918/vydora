import { describe, it, expect } from "vitest";
import { FEATURE_PAGES } from "./featurePages";
import { GUIDES } from "./guides";
import { FEATURE_GUIDES, guidesForFeature } from "./related";
import { bodyFor } from "../../prerender";

describe("internal links", () => {
  it("every feature page links to at least one real guide", () => {
    for (const f of FEATURE_PAGES) expect(guidesForFeature(f.slug).length).toBe((FEATURE_GUIDES[f.slug] ?? ["x"]).length);
  });
  it("every guide is linked from some feature page", () => {
    const linked = new Set(Object.values(FEATURE_GUIDES).flat());
    for (const g of GUIDES) expect(linked.has(g.slug)).toBe(true);
  });
  it("homepage crawler HTML links to every feature page and pricing", () => {
    const html = bodyFor("/");
    for (const f of FEATURE_PAGES) expect(html).toContain(`href="/${f.slug}"`);
    expect(html).toContain('href="/pricing"');
  });
  it("the Autopilot guide no longer says videos need a button press", () => {
    const g = GUIDES.find((x) => x.slug === "automate-youtube-channel-with-ai")!;
    expect(JSON.stringify(g)).not.toMatch(/press Make video|never automatically/);
  });
});
