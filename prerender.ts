// Build-time prerender: writes dist/<route>/index.html for every public page so
// crawlers get page-specific head tags and readable content before JavaScript runs.
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";
import { PUBLIC_PAGES, SITE } from "./src/lib/seo";
import { FEATURE_PAGES } from "./src/lib/featurePages";
import { GUIDES } from "./src/lib/guides";
import { guidesForFeature } from "./src/lib/related";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const NAV: [string, string][] = [
  ["/", "AI YouTube video maker"], ["/pricing", "Pricing"], ["/faceless-youtube-channel", "Faceless YouTube channels"],
  ["/article-to-video", "Article to video"], ["/youtube-shorts-maker", "YouTube Shorts maker"], ["/text-to-video", "Text to video"],
  ["/youtube-series-generator", "Series generator"], ["/youtube-autopilot", "YouTube Autopilot"], ["/ai-product-ads", "AI product ads"], ["/ai-voiceover-video-maker", "AI voiceover"], ["/ai-story-video-generator", "Story videos"],
  ["/guides", "Creator guides"],
];

export function bodyFor(route: string): string {
  const page = PUBLIC_PAGES[route];
  const f = FEATURE_PAGES.find((p) => "/" + p.slug === route);
  const g = GUIDES.find((x) => "/guides/" + x.slug === route);
  let main = "";
  if (f) {
    main = `<h1>${esc(f.h1)}</h1><p>${esc(f.intro)}</p><h2>How it works</h2><ol>${f.steps.map((s) => `<li><strong>${esc(s.title)}</strong> – ${esc(s.text)}</li>`).join("")}</ol>` +
      f.sections.map((s) => `<h2>${esc(s.heading)}</h2>${s.paras.map((p) => `<p>${esc(p)}</p>`).join("")}`).join("") +
      `<h2>Questions</h2>${f.faqs.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}` +
      `<h2>Helpful guides</h2><ul>${guidesForFeature(f.slug).map((x) => `<li><a href="/guides/${x.slug}">${esc(x.h1)}</a></li>`).join("")}</ul>` +
      `<p><a href="${esc(f.cta.to)}">${esc(f.cta.label)}</a> · <a href="/pricing">See plans and pricing</a></p>`;
  } else if (g) {
    main = `<article><h1>${esc(g.h1)}</h1><p>${esc(g.intro)}</p>` +
      g.sections.map((s) => `<h2>${esc(s.heading)}</h2>${s.paras.map((p) => `<p>${esc(p)}</p>`).join("")}${s.list ? `<ul>${s.list.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}`).join("") +
      (g.sources ? `<h2>Sources</h2><ul>${g.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.label)}</a></li>`).join("")}</ul>` : "") +
      `<p><a href="${esc(g.related.to)}">${esc(g.related.label)}</a> · <a href="/pricing">Compare plans and prices</a></p></article>`;
  } else if (route === "/guides") {
    main = `<h1>YouTube creator guides</h1><p>${esc(page.description)}</p><ul>${GUIDES.map((x) => `<li><a href="/guides/${x.slug}">${esc(x.h1)}</a> – ${esc(x.description)}</li>`).join("")}</ul>`;
  } else if (route === "/") {
    main = `<h1>AI YouTube video generator &amp; faceless video maker</h1><p>Type an idea or paste an article link. Vydora writes the script, creates a picture for every scene, records an AI voiceover and exports a YouTube-ready video. No camera, no editing skills needed.</p>` +
      `<h2>How it works</h2><ol><li>Describe your video or paste a link.</li><li>Vydora writes the script and makes the scenes and narration.</li><li>Preview, tweak and export or publish to YouTube.</li></ol>` +
      `<h2>Features</h2><ul>${FEATURE_PAGES.map((x) => `<li><a href="/${x.slug}">${esc(x.eyebrow)}</a> – ${esc(x.description)}</li>`).join("")}</ul>` +
      `<h2>Plans</h2><p>Free: 30 credits every month. Creator: £19/month with 600 credits. Pro: £49/month with 2,000 credits. <a href="/pricing">Compare plans</a>.</p>` +
      `<h2>Who uses Vydora</h2><p>Beginners and faceless channels making history, true crime, science, finance, horror stories and explainer videos.</p>`;
  } else {
    main = `<h1>${esc(page.title.split(/ [–|] /)[0])}</h1><p>${esc(page.description)}</p>`;
  }
  const nav = `<nav><ul>${NAV.map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join("")}</ul></nav>`;
  return `<main style="max-width:720px;margin:0 auto;padding:48px 16px;font-family:sans-serif;color:#eee">${main}${nav}</main>`;
}

export function htmlFor(template: string, route: string): string {
  const p = PUBLIC_PAGES[route];
  const url = SITE + (route === "/" ? "/" : route);
  const t = esc(p.title), d = esc(p.description);
  const g = GUIDES.find((x) => "/guides/" + x.slug === route);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${t}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta name="twitter:title" content=")[^"]*/, `$1${t}`)
    .replace(/(<meta name="twitter:description" content=")[^"]*/, `$1${d}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace(/<div id="root">[\s\S]*?<\/div>\s*(?=<script|<\/body>)/, `<div id="root">${bodyFor(route)}</div>\n    `);
  if (g) {
    html = html.replace(/(<meta property="og:type" content=")[^"]*/, "$1article");
    const org = { "@type": "Organization", name: "Vydora", url: SITE + "/", logo: { "@type": "ImageObject", url: SITE + "/apple-touch-icon.png" } };
    const ld = { "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.description, url, mainEntityOfPage: url, inLanguage: "en-GB", author: org, publisher: org };
    html = html.replace("</head>", `  <script type="application/ld+json">${JSON.stringify(ld)}</script>\n  </head>`);
  }
  return html;
}

export default function prerender(): Plugin {
  return {
    name: "vydora-prerender",
    apply: "build",
    closeBundle() {
      const dist = path.resolve(__dirname, "dist");
      const tplPath = path.join(dist, "index.html");
      if (!fs.existsSync(tplPath)) return;
      const template = fs.readFileSync(tplPath, "utf8");
      // Pages served by the app fallback (private or unknown addresses) must not claim
      // the homepage as their canonical address: drop it and mark them noindex.
      const publicList = JSON.stringify(Object.keys(PUBLIC_PAGES));
      const guard = `<script>(function(){var p=location.pathname.replace(/\\/+$/,"")||"/";if(${publicList}.indexOf(p)<0){var c=document.querySelector('link[rel="canonical"]');if(c)c.remove();var m=document.createElement("meta");m.name="robots";m.content="noindex, nofollow";document.head.appendChild(m);}})();</script>`;
      const guarded = template.replace("</head>", `  ${guard}\n  </head>`);
      fs.writeFileSync(path.join(dist, "404.html"), guarded.replace(/<link rel="canonical"[^>]*>\s*/, "").replace(/<title>[\s\S]*?<\/title>/, "<title>Page not found | Vydora</title>"));
      for (const route of Object.keys(PUBLIC_PAGES)) {
        const out = route === "/" ? tplPath : path.join(dist, route.slice(1), "index.html");
        fs.mkdirSync(path.dirname(out), { recursive: true });
        const html = htmlFor(route === "/" ? guarded : template, route);
        fs.writeFileSync(out, html);
        // Also write <route>.html so hosts that map /slug to slug.html never fall back to the homepage shell.
        if (route !== "/") fs.writeFileSync(path.join(dist, route.slice(1) + ".html"), html);
      }
    },
  };
}
