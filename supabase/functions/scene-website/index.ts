import { charge, refund, requireMutable, COSTS } from "../_shared/credits.ts";
import { corsHeaders, json, getCaller, adminClient } from "../_shared/common.ts";

// Product ads only: replaces one scene's picture with a real screenshot of the product website.
// mode "auto" picks the page that best matches the scene's words; mode "url" uses a page the user typed (same website only).
const COST = COSTS.image + COSTS.webCapture;
const FC = "https://connector-gateway.lovable.dev/firecrawl/v2";
const BLOCKED = /about|contact|team|career|job|press|investor|support|help|faq|privacy|terms|cookie|legal|disclaimer|gdpr|policy|sitemap|accessib|login|log-in|signin|sign-in|signup|sign-up|register|cart|checkout|account|billing|password|status|feedback|report/i;
const STOP = new Set("the and for you your our with this that from are can will all into here there what when where which their they them have has its more most just get let lets see now about any how who why use using also been each like make than then very".split(" "));
const tokens = (t: string) => t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/ies$/, "y").replace(/s$/, ""));

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || (!h.includes(".") && !h.includes(":"))) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) { const [a, b] = [Number(v4[1]), Number(v4[2])]; return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224; }
  if (/^\d+$/.test(h) || /^0x/.test(h)) return true;
  if (h.includes(":")) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await getCaller(req);
    if (!auth) return json({ error: "Please sign in first." }, 401);
    const body = await req.json().catch(() => ({}));
    const { sceneId, mode, url } = body ?? {};
    if (typeof sceneId !== "string" || (mode !== "auto" && mode !== "url") || (mode === "url" && (typeof url !== "string" || url.length > 2000))) return json({ error: "Invalid request." }, 400);

    const { data: scene } = await auth.client.from("video_scenes")
      .select("id, video_id, heading, narration, visual_prompt, videos(kind, source_url)")
      .eq("id", sceneId).eq("user_id", auth.user.id).maybeSingle();
    if (!scene) return json({ error: "Scene not found." }, 404);
    // deno-lint-ignore no-explicit-any
    const v = (scene as any).videos;
    if (v?.kind !== "ad" || !v?.source_url) return json({ error: "Website images are only for product ads with a website link." }, 400);
    let site: URL;
    try { site = new URL(v.source_url); } catch { return json({ error: "This ad's website link isn't valid." }, 400); }
    const host = site.hostname.replace(/^www\./, "");
    const sameSite = (l: string) => { try { const u = new URL(l); return /^https?:$/.test(u.protocol) && u.hostname.replace(/^www\./, "") === host && !isPrivateHost(u.hostname); } catch { return false; } };

    let target = "";
    if (mode === "url") {
      const raw = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
      if (!sameSite(raw)) return json({ error: `Please enter a page on ${host}.` }, 400);
      target = raw;
    }

    const blocked = await requireMutable(auth.user.id);
    if (blocked) return blocked;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey || !fcKey) return json({ error: "Website capture is not set up." }, 500);
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": fcKey };

    const denied = await charge(auth.user.id, COST, "scene_website_image");
    if (denied) return denied;
    let charged = COST;
    try {
      if (mode === "auto") {
        const r = await fetch(`${FC}/map`, { method: "POST", headers, body: JSON.stringify({ url: site.toString(), limit: 200 }) });
        const links: { url: string; title?: string; description?: string }[] = r.ok ? ((await r.json())?.links ?? []).map((l: any) => typeof l === "string" ? { url: l } : l).filter((l: any) => l?.url) : [];
        const want = new Set(tokens(`${scene.heading ?? ""} ${scene.narration ?? ""} ${scene.visual_prompt ?? ""}`));
        let best = "", bestScore = 0;
        for (const l of links) {
          if (!sameSite(l.url)) continue;
          let path = ""; try { path = new URL(l.url).pathname; } catch { continue; }
          if (path === "/" || path === "" || BLOCKED.test(path) || BLOCKED.test(l.title ?? "") || /\.(pdf|jpe?g|png|gif|svg|zip|xml|webp)$/i.test(path)) continue;
          let s = 0;
          for (const w of new Set(tokens(path))) if (want.has(w)) s += 3;
          for (const w of new Set(tokens(`${l.title ?? ""} ${l.description ?? ""}`))) if (want.has(w)) s += 1;
          if (s > bestScore || (s === bestScore && s > 0 && l.url.length < best.length)) { best = l.url; bestScore = s; }
        }
        if (!best || bestScore < 3) return json({ error: "Couldn't find a page on the website that matches this scene. Try “Enter URL” instead. Your credits were returned." }, 422);
        target = best;
      }

      const hide = `document.querySelectorAll('[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[class*=gdpr i],[id*=onetrust i],[class*=cmp i],.fc-consent-root,.cc-window').forEach(e=>e.remove());document.body.style.overflow='auto';`;
      const r = await fetch(`${FC}/scrape`, { method: "POST", headers, body: JSON.stringify({ url: target, formats: ["screenshot"], actions: [{ type: "wait", milliseconds: 1500 }, { type: "executeJavascript", script: hide }, { type: "wait", milliseconds: 300 }] }) });
      const b = r.ok ? await r.json() : null;
      const img: string | undefined = b?.data?.screenshot ?? b?.screenshot;
      if (!img?.startsWith("https://")) return json({ error: "Couldn't take a screenshot of that page. Your credits were returned." }, 502);
      const res = await fetch(img);
      if (!res.ok) return json({ error: "Couldn't save the screenshot. Your credits were returned." }, 502);
      const type = res.headers.get("content-type") ?? "image/png";
      const path = `${auth.user.id}/${scene.video_id}/${scene.id}-website-${Date.now()}.${type.includes("jpeg") ? "jpg" : "png"}`;
      const admin = adminClient();
      const { error: upErr } = await admin.storage.from("video-assets").upload(path, new Uint8Array(await res.arrayBuffer()), { contentType: type });
      if (upErr) throw upErr;
      const { error: uErr } = await admin.from("video_scenes").update({ image_path: path, web_url: target, clip_path: null, clip_credit: null }).eq("id", scene.id);
      if (uErr) throw uErr;
      charged = 0;
      return json({ path, url: target });
    } finally {
      if (charged) await refund(auth.user.id, charged, "refund_scene_website_image");
    }
  } catch (e) {
    console.error("scene-website error", e);
    return json({ error: "Something went wrong capturing the website." }, 500);
  }
});
