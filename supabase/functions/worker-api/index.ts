// Worker gateway: the only way the Railway render worker talks to Vydora.
// Auth = WORKER_SECRET bearer token (never the service-role key). Every action is bound to a job the
// calling worker currently holds the lease on, so a worker can only see the one job it claimed.
// Credits, refunds, storage permissions and Google refresh tokens never leave this function.
import { adminClient, signTask } from "../_shared/common.ts";

const SECRET = Deno.env.get("WORKER_SECRET") ?? "";
const CID = Deno.env.get("GOOGLE_YOUTUBE_CLIENT_ID") ?? "";
const CSECRET = Deno.env.get("GOOGLE_YOUTUBE_CLIENT_SECRET") ?? "";
const BUCKET = "video-assets";
const URL_TTL = 2 * 3600;
const LEASE = 300;
const ok = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });

async function sameSecret(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest("SHA-256", enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0; for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0 && b.length > 0;
}

type DB = ReturnType<typeof adminClient>;
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const workerOk = (s: unknown): s is string => typeof s === "string" && /^[A-Za-z0-9._:-]{1,64}$/.test(s);

async function sign(db: DB, p: string | null | undefined, userId: string) {
  if (!p) return null;
  if (!p.startsWith(`${userId}/`)) throw new Error("asset outside owner folder");
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(p, URL_TTL);
  if (error) throw new Error(`sign failed for asset`);
  return { url: data.signedUrl, ext: p.split(".").pop() ?? "bin" };
}

async function heldJob(db: DB, id: unknown, worker: string) {
  if (!isUuid(id)) return null;
  const { data } = await db.from("render_jobs").select("*").eq("id", id).eq("locked_by", worker)
    .not("status", "in", "(completed,failed,cancelled)").maybeSingle();
  return data;
}

async function log(db: DB, job: { id: string; user_id: string }, message: string, level = "info") {
  await db.from("render_job_events").insert({ job_id: job.id, user_id: job.user_id, level: level === "warn" || level === "error" ? level : "info", message: String(message).slice(0, 2000) });
}

async function ytToken(db: DB, uid: string) {
  const { data: c } = await db.from("youtube_connections").select("access_token, refresh_token, expires_at").eq("user_id", uid).maybeSingle();
  if (!c) return { error: "YouTube channel not connected", permanent: true };
  if (new Date(c.expires_at).getTime() - 5 * 60_000 > Date.now()) return { token: c.access_token as string, expires_at: c.expires_at };
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: CSECRET, refresh_token: c.refresh_token, grant_type: "refresh_token" }) });
  const t = await r.json();
  if (!r.ok || !t.access_token) return { error: "YouTube access expired; please reconnect", permanent: t.error === "invalid_grant" };
  const expires_at = new Date(Date.now() + t.expires_in * 1000).toISOString();
  await db.from("youtube_connections").update({ access_token: t.access_token, expires_at }).eq("user_id", uid);
  return { token: t.access_token as string, expires_at };
}

// ---------- Autopilot (hands-off generation) ----------
// The worker is the clock: each poll it leases one due run, gets one bounded step (script, or a batch of scene
// pictures/voices) with a short-lived task token for that run's owner, calls the normal generate-script /
// scene-asset functions (which charge and refund credits exactly as for manual creation), then reports back.
// Only missing assets are requested, so retries never pay twice. When every scene is ready a render job is queued.
const BATCH = 6;
type Run = { id: string; plan_id: string; user_id: string; video_id: string | null; attempts: number };

async function finishRun(db: DB, run: Run, status: "skipped" | "failed", note: string) {
  await db.from("autopilot_runs").update({ status, error: note, locked_by: null, locked_until: null, updated_at: new Date().toISOString() }).eq("id", run.id);
  await db.from("autopilot_plans").update({ status, note }).eq("id", run.plan_id);
}

async function autopilotClaim(db: DB, worker: string) {
  const { data, error } = await db.rpc("claim_autopilot_run", { _worker: worker, _lease_seconds: 240 });
  if (error) throw error;
  const run = (Array.isArray(data) ? data[0] : null) as Run | null;
  if (!run) return { run: null };
  const { data: plan } = await db.from("autopilot_plans").select("*").eq("id", run.plan_id).maybeSingle();
  if (!plan) { await finishRun(db, run, "failed", "Plan was removed"); return { run: null }; }
  if (run.attempts >= 30) { await finishRun(db, run, "failed", "Gave up after repeated errors"); return { run: null }; }
  const token = await signTask(run.user_id);
  if (!run.video_id) {
    const st = (plan.settings ?? {}) as Record<string, unknown>;
    return { run: { id: run.id }, token, tasks: [{ fn: "generate-script", body: {
      topic: plan.topic, style: st.style, voice: st.voice, tone: st.tone, sceneCount: Number(st.scenes) || 6, captionStyle: st.caption,
      aspectRatio: st.ratio, quality: st.quality, targetSeconds: Number(st.length) || undefined, accent: st.accent,
      narrationSpeed: Number(st.speed) || 1, useFacts: st.useFacts === true } }] };
  }
  const { data: scenes } = await db.from("video_scenes").select("id, image_path, clip_path, audio_path").eq("video_id", run.video_id).eq("user_id", run.user_id).order("position");
  const tasks: { fn: string; body: Record<string, unknown> }[] = [];
  for (const s of scenes ?? []) {
    if (!s.image_path && !s.clip_path) tasks.push({ fn: "scene-asset", body: { sceneId: s.id, kind: "image" } });
    if (!s.audio_path) tasks.push({ fn: "scene-asset", body: { sceneId: s.id, kind: "audio" } });
  }
  if (!scenes?.length) { await finishRun(db, run, "failed", "Script had no scenes"); return { run: null }; }
  if (tasks.length) return { run: { id: run.id }, token, tasks: tasks.slice(0, BATCH) };
  // Everything is ready: queue the cloud render (and YouTube upload) once.
  const key = `autopilot:${run.plan_id}`;
  let { data: job } = await db.from("render_jobs").select("id").eq("idempotency_key", key).maybeSingle();
  if (!job) {
    const ins = await db.from("render_jobs").insert({ user_id: run.user_id, video_id: run.video_id, plan_id: run.plan_id, kind: "autopilot",
      idempotency_key: key, publish: !!plan.publish_on, publish_at: plan.publish_on }).select("id").single();
    if (ins.error) throw ins.error;
    job = ins.data;
  }
  await db.from("autopilot_runs").update({ status: "rendering", render_job_id: job!.id, locked_by: null, locked_until: null, error: null, updated_at: new Date().toISOString() }).eq("id", run.id);
  await db.from("autopilot_plans").update({ status: "made", video_id: run.video_id, note: null }).eq("id", run.plan_id);
  return { run: null, queued: job!.id };
}

async function autopilotResult(db: DB, worker: string, body: Record<string, unknown>) {
  if (!isUuid(body.run)) return { error: "bad run" };
  const { data: run } = await db.from("autopilot_runs").select("*").eq("id", body.run).eq("locked_by", worker).eq("status", "generating").maybeSingle() as { data: Run | null };
  if (!run) return { error: "not_owner" };
  const results = Array.isArray(body.results) ? body.results as { fn?: string; status?: number; videoId?: string; error?: string }[] : [];
  const script = results.find((r) => r.fn === "generate-script" && r.status === 200 && isUuid(r.videoId));
  if (script && !run.video_id) {
    const { data: v } = await db.from("videos").select("id").eq("id", script.videoId!).eq("user_id", run.user_id).maybeSingle();
    if (v) {
      const { data: plan } = await db.from("autopilot_plans").select("settings").eq("id", run.plan_id).maybeSingle();
      const mood = String((plan?.settings as Record<string, unknown> | null)?.mood ?? "none");
      await db.from("videos").update({ music_mood: mood, music_enabled: mood !== "none" }).eq("id", v.id);
      await db.from("autopilot_runs").update({ video_id: v.id }).eq("id", run.id);
      await db.from("autopilot_plans").update({ video_id: v.id }).eq("id", run.plan_id);
    }
  }
  const noCredits = results.find((r) => r.status === 402);
  if (noCredits) { await finishRun(db, run, "skipped", "Skipped: not enough credits. Top up and press Retry."); return { ok: true }; }
  const hard = results.find((r) => r.status && r.status >= 400 && r.status < 500 && r.status !== 429);
  if (hard) { await finishRun(db, run, "failed", String(hard.error ?? "Couldn't make this video").slice(0, 500)); return { ok: true }; }
  const soft = results.some((r) => !r.status || r.status >= 429);
  await db.from("autopilot_runs").update({ locked_by: null, locked_until: null, updated_at: new Date().toISOString(),
    run_after: new Date(Date.now() + (soft ? 120_000 : 0)).toISOString(), error: soft ? String(results.find((r) => r.error)?.error ?? "Temporary error, retrying").slice(0, 500) : null }).eq("id", run.id);
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok({ error: "method" }, 405);
  if (!SECRET) return ok({ error: "Worker gateway not configured" }, 503);
  const auth = req.headers.get("authorization") ?? "";
  if (!(await sameSecret(auth.replace(/^Bearer\s+/i, ""), SECRET))) return ok({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const action = body?.action;
  const worker = typeof body?.worker === "string" ? body.worker.trim().replace(/^["']+|["']+$/g, "").trim() : body?.worker;
  if (!workerOk(worker)) {
    console.warn("invalid worker id", JSON.stringify({ type: typeof body?.worker, length: typeof body?.worker === "string" ? body.worker.length : null }));
    return ok({ error: "invalid worker id" }, 400);
  }
  const db = adminClient();
  try {
    if (action === "claim") {
      const { data, error } = await db.rpc("claim_render_job", { _worker: worker, _lease_seconds: LEASE });
      if (error) throw error;
      const job = Array.isArray(data) ? data[0] : null;
      if (!job) return ok({ job: null });
      const fail = async (msg: string) => { await db.rpc("fail_render_job", { _job: job.id, _worker: worker, _error: msg, _retry: false }); return ok({ job: null }); };
      const { data: v } = await db.from("videos").select("*").eq("id", job.video_id).eq("user_id", job.user_id).maybeSingle();
      if (!v) return fail("Video not found");
      const { data: rows } = await db.from("video_scenes").select("position, image_path, clip_path, audio_path, narration")
        .eq("video_id", v.id).order("position");
      if (!rows?.length) return fail("Video has no scenes");
      const missing = rows.filter((s) => !s.image_path && !s.clip_path).map((s) => s.position + 1);
      if (missing.length) return fail(`Scenes missing pictures: ${missing.join(", ")}`);
      const { data: acct } = await db.rpc("effective_account", { _user: job.user_id });
      const outputPath = job.output_path ?? `${job.user_id}/${v.id}/exports/worker-${job.id}.mp4`;
      let upload = null, output = null;
      if (job.output_path) output = await sign(db, job.output_path, job.user_id);
      else if (!job.publish || !job.youtube_video_id) {
        const { data: up, error: ue } = await db.storage.from(BUCKET).createSignedUploadUrl(outputPath, { upsert: true });
        if (ue) throw ue;
        upload = { url: up.signedUrl, path: outputPath };
      }
      const scenes = [];
      for (const s of rows) scenes.push({ position: s.position, caption: s.narration, image: await sign(db, s.image_path, job.user_id), clip: await sign(db, s.clip_path, job.user_id), audio: await sign(db, s.audio_path, job.user_id) });
      // Only render-relevant video settings; no profile, billing or account data.
      const { user_id: _u, seo: _s, sources: _src, ...settings } = v;
      return ok({
        job: { id: job.id, attempts: job.attempts, publish: job.publish, output_path: job.output_path, size_bytes: job.size_bytes, youtube_session_url: job.youtube_session_url, youtube_video_id: job.youtube_video_id },
        video: settings, scenes, music: await sign(db, v.music_path, job.user_id), logo: await sign(db, v.logo_path, job.user_id),
        watermark: !(acct?.pro || acct?.isAdmin), upload, output, lease_seconds: LEASE,
      });
    }

    if (action === "autopilot_claim") return ok(await autopilotClaim(db, worker));
    if (action === "autopilot_result") return ok(await autopilotResult(db, worker, body));

    const job = await heldJob(db, body.job, worker);
    if (!job) return ok({ error: "not_owner", lost: true }, 409);

    switch (action) {
      case "heartbeat": {
        const { data } = await db.rpc("heartbeat_render_job", { _job: job.id, _worker: worker, _lease_seconds: LEASE });
        return ok({ ok: data === true });
      }
      case "progress": {
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (["rendering", "uploading"].includes(body.status)) patch.status = body.status;
        if (Number.isFinite(body.progress)) patch.progress = Math.max(0, Math.min(99, Math.round(body.progress)));
        await db.from("render_jobs").update(patch).eq("id", job.id).eq("locked_by", worker);
        if (typeof body.message === "string") await log(db, job, body.message, body.level);
        return ok({ ok: true });
      }
      case "uploaded": {
        const p = `${job.user_id}/${job.video_id}/exports/worker-${job.id}.mp4`;
        const folder = p.slice(0, p.lastIndexOf("/"));
        const { data: files } = await db.storage.from(BUCKET).list(folder, { search: `worker-${job.id}.mp4` });
        const f = files?.find((x) => x.name === `worker-${job.id}.mp4`);
        const size = Number(f?.metadata?.size ?? 0);
        if (!f || size <= 0) return ok({ error: "upload not found" }, 400);
        await db.from("render_jobs").update({ output_path: p, size_bytes: size, progress: 92, updated_at: new Date().toISOString() }).eq("id", job.id).eq("locked_by", worker);
        return ok({ ok: true, size_bytes: size });
      }
      case "youtube_token": {
        if (!job.publish) return ok({ error: "publishing not requested" }, 400);
        const t = await ytToken(db, job.user_id);
        return ok(t, "error" in t ? 400 : 200);
      }
      case "youtube_session": {
        // Server builds the YouTube metadata; worker only receives the resumable session URL.
        if (!job.publish || !job.output_path || !job.size_bytes) return ok({ error: "not ready" }, 400);
        if (job.youtube_session_url) return ok({ session: job.youtube_session_url });
        const t = await ytToken(db, job.user_id);
        if ("error" in t) return ok(t, 400);
        const { data: v } = await db.from("videos").select("title, seo, description").eq("id", job.video_id).single();
        const seo = (v?.seo ?? {}) as Record<string, unknown>;
        const publishAt = job.publish_at && new Date(job.publish_at).getTime() > Date.now() + 5 * 60_000 ? new Date(job.publish_at).toISOString() : null;
        const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
          method: "POST", headers: { Authorization: `Bearer ${t.token}`, "Content-Type": "application/json", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(job.size_bytes) },
          body: JSON.stringify({ snippet: { title: String(seo.title ?? v?.title ?? "Untitled").slice(0, 100), description: String(seo.description ?? v?.description ?? "").slice(0, 5000), tags: Array.isArray(seo.tags) ? seo.tags.slice(0, 30) : [], categoryId: "22" },
            status: { privacyStatus: "private", ...(publishAt ? { publishAt } : {}), selfDeclaredMadeForKids: false, containsSyntheticMedia: true } }),
        });
        if (!init.ok) return ok({ error: `YouTube refused upload: ${init.status}` }, 400);
        const session = init.headers.get("Location");
        await db.from("render_jobs").update({ youtube_session_url: session, youtube_bytes_sent: 0 }).eq("id", job.id).eq("locked_by", worker);
        return ok({ session });
      }
      case "youtube_reset": {
        await db.from("render_jobs").update({ youtube_session_url: null, youtube_bytes_sent: 0 }).eq("id", job.id).eq("locked_by", worker);
        return ok({ ok: true });
      }
      case "youtube_bytes": {
        if (Number.isFinite(body.bytes)) await db.from("render_jobs").update({ youtube_bytes_sent: Math.max(0, Math.floor(body.bytes)) }).eq("id", job.id).eq("locked_by", worker);
        return ok({ ok: true });
      }
      case "complete": {
        if (!job.output_path) return ok({ error: "no output uploaded" }, 400);
        const patch: Record<string, unknown> = { status: "completed", progress: 100, completed_at: new Date().toISOString(), locked_by: null, locked_until: null, updated_at: new Date().toISOString() };
        if (job.publish) {
          if (typeof body.youtube_video_id !== "string" || !/^[A-Za-z0-9_-]{6,20}$/.test(body.youtube_video_id)) return ok({ error: "missing YouTube id" }, 400);
          patch.youtube_video_id = body.youtube_video_id;
        }
        const { error } = await db.from("render_jobs").update(patch).eq("id", job.id).eq("locked_by", worker);
        if (error) throw error;
        await log(db, job, "Completed");
        return ok({ ok: true });
      }
      case "fail": {
        const { data } = await db.rpc("fail_render_job", { _job: job.id, _worker: worker, _error: String(body.error ?? "Unknown error").slice(0, 2000), _retry: body.permanent !== true });
        return ok({ result: data });
      }
      default: return ok({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error("worker-api", action, e);
    return ok({ error: "server error" }, 500);
  }
});
