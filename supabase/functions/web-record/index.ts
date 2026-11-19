import { charge, refund, requireMutable, COSTS } from "../_shared/credits.ts";
import { corsHeaders, json, getCaller, adminClient } from "../_shared/common.ts";

// Product ads only: queues a live browser recording of a website scene (real page, moving cursor, clicks, scrolling).
// The cloud worker records it; the MP4 becomes the scene's clip. Charged like "Animate scene", refunded on failure.
const COST = COSTS.animate;
const STALE_QUEUE_MS = 20 * 60_000;

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) return true; // only real domain names
  return h.includes(":") || /^0x/.test(h);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await getCaller(req);
    if (!auth) return json({ error: "Please sign in first." }, 401);
    const { sceneId, action, seconds, url } = await req.json().catch(() => ({}));
    if (typeof sceneId !== "string" || (action !== "start" && action !== "status")) return json({ error: "Invalid request." }, 400);
    const admin = adminClient();

    if (action === "status") {
      const { data: rec } = await admin.from("web_recordings").select("*").eq("scene_id", sceneId).eq("user_id", auth.user.id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!rec) return json({ status: "none" });
      const stuck = (rec.status === "queued" && Date.now() - new Date(rec.created_at).getTime() > STALE_QUEUE_MS) ||
        (rec.status === "recording" && rec.attempts >= 3 && new Date(rec.locked_until ?? 0).getTime() < Date.now());
      if (stuck) {
        const { data: upd } = await admin.from("web_recordings").update({ status: "failed", error: "The recorder is busy right now. Please try again later.", updated_at: new Date().toISOString() })
          .eq("id", rec.id).eq("status", rec.status).select("id").maybeSingle();
        if (upd && rec.charged) await refund(rec.user_id, rec.charged, "refund_web_recording");
        return json({ status: "failed", error: "The recorder is busy right now. Your credits were returned." });
      }
      return json({ status: rec.status, error: rec.error, url: rec.url });
    }

    const { data: scene } = await auth.client.from("video_scenes")
      .select("id, video_id, image_path, web_url, videos(kind, source_url, aspect_ratio)")
      .eq("id", sceneId).eq("user_id", auth.user.id).maybeSingle();
    if (!scene) return json({ error: "Scene not found." }, 404);
    // deno-lint-ignore no-explicit-any
    const v = (scene as any).videos;
    if (v?.kind !== "ad" || !v?.source_url) return json({ error: "Live website recording is only for product ads with a website link." }, 400);
    let site: URL; try { site = new URL(v.source_url); } catch { return json({ error: "This ad's website link isn't valid." }, 400); }
    const host = site.hostname.replace(/^www\./, "");
    const rawIn = typeof url === "string" && url.trim() ? url.trim().slice(0, 2000) : (scene.web_url ?? site.toString());
    let target: URL; try { target = new URL(rawIn.startsWith("http") ? rawIn : `https://${rawIn}`); } catch { return json({ error: "Please enter a valid page address." }, 400); }
    if (!/^https?:$/.test(target.protocol) || target.hostname.replace(/^www\./, "") !== host || isPrivateHost(target.hostname)) return json({ error: `Please enter a page on ${host}.` }, 400);

    const blocked = await requireMutable(auth.user.id);
    if (blocked) return blocked;
    const denied = await charge(auth.user.id, COST, "web_recording");
    if (denied) return denied;
    const secs = Math.min(15, Math.max(4, Math.ceil(typeof seconds === "number" && isFinite(seconds) ? seconds : 6)));
    const aspect = ["9:16", "4:5"].includes(v.aspect_ratio) ? "9:16" : "16:9";
    const { error } = await admin.from("web_recordings").insert({ user_id: auth.user.id, video_id: scene.video_id, scene_id: scene.id, url: target.toString(), seconds: secs, aspect, charged: COST });
    if (error) {
      await refund(auth.user.id, COST, "refund_web_recording");
      return json({ error: error.code === "23505" ? "This scene is already being recorded." : "Couldn't start the recording." }, error.code === "23505" ? 409 : 500);
    }
    return json({ status: "queued", url: target.toString() });
  } catch (e) {
    console.error("web-record error", e);
    return json({ error: "Something went wrong starting the recording." }, 500);
  }
});
