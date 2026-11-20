import { describe, it, expect } from "vitest";
import { authHtmlFor, htmlFor } from "../../prerender";
import { seoFor } from "./seo";

const tpl = `<html><head><title>X</title><meta name="description" content="x" /><link rel="canonical" href="https://vydora.ai/" /></head><body><div id="root"></div>
<script></script></body></html>`;

describe("safe browsing prep", () => {
  it("auth page HTML has its own title and noindex, follow before scripts run", () => {
    const h = authHtmlFor(tpl);
    expect(h).toContain("<title>Sign In or Create Account | Vydora</title>");
    expect(h).toContain('content="noindex, follow"');
    expect(h).not.toContain('rel="canonical"');
  });
  it("public pages carry the independence notice and stay indexable", () => {
    const h = htmlFor(tpl, "/pricing");
    expect(h).toContain("not affiliated with, endorsed by, or sponsored by Google or YouTube");
    expect(h).not.toContain("noindex");
    expect(seoFor("/pricing").robots).toBe("index, follow");
  });
  it("auth route robots is noindex, follow", () => {
    expect(seoFor("/auth").robots).toBe("noindex, follow");
  });
});
