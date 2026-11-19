// Live website recording for product-ad scenes: a real Chromium browser opens the page, a visible cursor
// moves around, hovers and clicks real links on the same site and scrolls through the content.
// Only the ad's own website is reachable; other hosts and private addresses are blocked.
import { mkdir, rm, readFile, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { api } from "./api.mjs";

const WORK = process.env.WORK_DIR ?? "/tmp/vydora";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PRIVATE = /^(localhost|.*\.local|.*\.internal|\d+\.\d+\.\d+\.\d+|\[.*\])$/i;

const CURSOR = `(() => { if (window !== window.top || window.__vyCursor) return; window.__vyCursor = 1;
  const c = document.createElement('div');
  c.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(-4px,-2px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))';
  const add = () => document.body && document.body.appendChild(c); add(); document.addEventListener('DOMContentLoaded', add);
  document.addEventListener('mousemove', (e) => { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; }, true);
  document.addEventListener('mousedown', (e) => { const r = document.createElement('div');
    r.style.cssText = 'position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:3px solid #ff3b3b;width:14px;height:14px;left:' + (e.clientX - 7) + 'px;top:' + (e.clientY - 7) + 'px;transition:all .5s ease-out;opacity:1';
    document.body.appendChild(r); requestAnimationFrame(() => { r.style.transform = 'scale(4)'; r.style.opacity = '0'; }); setTimeout(() => r.remove(), 600); }, true);
})();`;
const HIDE = `(()=>{const b=[...document.querySelectorAll('button,[role=button],a')].find(e=>/^(reject( all)?|decline|no,? thanks|only necessary|necessary only|accept( all)?|i agree|agree|got it)$/i.test((e.innerText||'').trim()));if(b)b.click();
document.querySelectorAll('[id*=cookie i],[class*=cookie i],[aria-label*=cookie i],[id*=consent i],[class*=consent i],[class*=gdpr i],[id*=onetrust i],.fc-consent-root,.cc-window').forEach(e=>{if(e===document.body||e===document.documentElement)return;const p=getComputedStyle(e).position;if((p==='fixed'||p==='sticky')&&(e.innerText||'').length<1500)e.style.setProperty('display','none','important');});
document.documentElement.style.overflow='auto';document.body.style.overflow='auto';})();`;
const BLOCKED = /about|contact|team|career|job|press|privacy|terms|cookie|legal|login|signin|sign-in|signup|sign-up|register|cart|checkout|account|billing|logout/i;

function ffmpeg(args) {
  return new Promise((res, rej) => { const p = spawn("ffmpeg", ["-y", "-loglevel", "error", ...args]); let e = ""; p.stderr.on("data", (d) => (e += d)); p.on("close", (c) => (c === 0 ? res() : rej(new Error(`ffmpeg: ${e.slice(0, 300)}`)))); });
}

async function glide(page, from, to, ms) {
  const steps = Math.max(10, Math.round(ms / 16));
  const cx = (from.x + to.x) / 2 + (Math.random() - 0.5) * 160, cy = (from.y + to.y) / 2 + (Math.random() - 0.5) * 120;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps, e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const x = (1 - e) ** 2 * from.x + 2 * (1 - e) * e * cx + e * e * to.x, y = (1 - e) ** 2 * from.y + 2 * (1 - e) * e * cy + e * e * to.y;
    await page.mouse.move(x, y); await sleep(ms / steps);
  }
  return to;
}

async function targets(page, host) {
  return page.evaluate(({ host, blocked }) => {
    const re = new RegExp(blocked, "i"), vw = innerWidth, vh = innerHeight, out = [];
    for (const el of document.querySelectorAll("a[href], button, [role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 16 || r.top < 60 || r.bottom > vh - 20 || r.left < 0 || r.right > vw) continue;
      const text = (el.innerText || el.getAttribute("aria-label") || "").trim();
      let href = null;
      if (el.tagName === "A") { try { const u = new URL(el.href); if (u.hostname.replace(/^www\./, "") !== host || u.hash && u.pathname === location.pathname) continue; href = u.href; } catch { continue; } }
      if (re.test(text) || (href && re.test(href))) continue;
      const boost = /explore|play|start|try|view|open|quiz|game|learn|discover|see|demo|feature|get/i.test(text) ? 4 : 1;
      out.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, href, area: r.width * r.height * boost, text: text.slice(0, 40) });
    }
    return out.sort((a, b) => b.area - a.area).slice(0, 12);
  }, { host, blocked: BLOCKED.source });
}

export async function recordWebsite(rec) {
  const { chromium } = await import("playwright");
  const vertical = rec.aspect === "9:16";
  const size = vertical ? { width: 540, height: 960 } : { width: 1280, height: 720 };
  const host = new URL(rec.url).hostname.replace(/^www\./, "");
  const dir = path.join(WORK, `web-${rec.id}`);
  await mkdir(dir, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, isMobile: vertical, hasTouch: false, acceptDownloads: false,
      recordVideo: { dir, size }, userAgent: vertical ? undefined : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" });
    const t0 = Date.now();
    await ctx.route("**/*", (route) => {
      try { const u = new URL(route.request().url()); if (!/^https?:$/.test(u.protocol) && u.protocol !== "data:" && u.protocol !== "blob:") return route.abort();
        if (/^https?:$/.test(u.protocol) && PRIVATE.test(u.hostname)) return route.abort();
        // Top-level navigation must stay on the ad's own website; page assets (fonts, CDNs) are allowed.
        if (route.request().isNavigationRequest() && route.request().frame() === route.request().frame().page().mainFrame() && u.hostname.replace(/^www\./, "") !== host) return route.abort();
      } catch { return route.abort(); }
      return route.continue();
    });
    await ctx.addInitScript(CURSOR);
    const page = await ctx.newPage();
    page.on("popup", (p) => p.close().catch(() => {}));
    await page.goto(rec.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.evaluate(HIDE).catch(() => {});
    await page.evaluate(CURSOR).catch(() => {});
    let pos = { x: size.width * 0.5, y: size.height * 0.4 };
    await page.mouse.move(pos.x, pos.y);
    await sleep(400);
    const start = (Date.now() - t0) / 1000;
    const end = Date.now() + rec.seconds * 1000 + 300;
    let clicked = false;
    while (Date.now() < end) {
      const left = end - Date.now();
      const t = await targets(page, host).catch(() => []);
      const pick = t.length ? (clicked ? t[Math.floor(Math.random() * Math.min(5, t.length))] : t[0]) : null;
      if (pick) { pos = await glide(page, pos, pick, Math.min(900, left)); await sleep(Math.min(350, Math.max(0, end - Date.now()))); }
      // One real click to open a feature page while there's time left to show it.
      if (pick && !clicked && end - Date.now() > rec.seconds * 400) {
        clicked = true;
        await page.mouse.down(); await sleep(90); await page.mouse.up();
        await page.waitForLoadState("domcontentloaded", { timeout: 6000 }).catch(() => {});
        await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
        await sleep(700); await page.evaluate(HIDE).catch(() => {}); await page.evaluate(CURSOR).catch(() => {});
        await page.mouse.move(pos.x, pos.y);
        continue;
      }
      if (end - Date.now() <= 0) break;
      // Smooth scroll down through the content.
      await page.evaluate(() => window.scrollBy({ top: innerHeight * 0.45, behavior: "smooth" })).catch(() => {});
      await sleep(Math.min(1100, Math.max(0, end - Date.now())));
    }
    await ctx.close();
    const webm = (await readdir(dir)).find((f) => f.endsWith(".webm"));
    if (!webm) throw new Error("no recording produced");
    const out = path.join(dir, "rec.mp4");
    await ffmpeg(["-ss", start.toFixed(2), "-i", path.join(dir, webm), "-t", String(rec.seconds), "-an", "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast", "-movflags", "+faststart", out]);
    return { file: out, dir };
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Claims and processes one live website recording. Returns true when there was work. */
export async function webTick() {
  const m = await api("web_claim");
  if (!m?.rec) return false;
  let dir = null;
  try {
    const r = await recordWebsite(m.rec); dir = r.dir;
    const put = await fetch(m.upload.url, { method: "PUT", headers: { "Content-Type": "video/mp4", "x-upsert": "true" }, body: await readFile(r.file) });
    if (!put.ok) throw new Error(`upload failed: ${put.status}`);
    await api("web_done", { rec: m.rec.id });
  } catch (e) {
    console.error("web recording", m.rec.id, e?.message ?? e);
    await api("web_fail", { rec: m.rec.id, error: String(e?.message ?? e) }).catch(() => {});
  } finally {
    await rm(dir ?? path.join(WORK, `web-${m.rec.id}`), { recursive: true, force: true }).catch(() => {});
  }
  return true;
}
