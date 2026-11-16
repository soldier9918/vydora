import { corsHeaders, json, getUserClient, adminClient } from "../_shared/common.ts";

// Stage 1: admins queue a cloud render test of an existing video. No credits are charged (exports are free).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await getUserClient(req);
    if (!auth) return json({ error: "Please sign in first." }, 401);
    const db = adminClient();
    const { data: isAdmin } = await db.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Not available yet." }, 403);
    const body = await req.json().catch(() => ({}));
    const videoId = typeof body.videoId === "string" && /^[0-9a-f-]{36}$/i.test(body.videoId) ? body.videoId : "";
    if (!videoId) return json({ error: "Invalid video." }, 400);
    const { data: video } = await auth.client.from("videos").select("id").eq("id", videoId).maybeSingle();
    if (!video) return json({ error: "Video not found." }, 404);
    const { data, error } = await db.from("render_jobs").insert({
      user_id: auth.user.id, video_id: videoId, kind: "render_test",
      idempotency_key: `test:${videoId}:${Date.now()}`, publish: false,
    }).select("id, status").single();
    if (error) throw error;
    return json(data);
  } catch (e) {
    console.error("render-job", e);
    return json({ error: "Couldn't queue the render." }, 500);
  }
});
