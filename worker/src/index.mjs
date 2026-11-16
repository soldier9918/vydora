// Vydora render worker: claims jobs from render_jobs, renders with FFmpeg, uploads to private storage,
// optionally uploads to YouTube (resumable). Safe to restart: leases expire and jobs are reclaimed.
import { createClient } from "@supabase/supabase-js";
import * as tus from "tus-js-client";
import { mkdir, rm, writeFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { renderVideo } from "./render.mjs";
import { youtubeUpload } from "./youtube.mjs";

const env = (k, d) => { const v = process.env[k] ?? d; if (v === undefined) throw new Error(`Missing env ${k}`); return v; };
const URL_ = env("SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const WORKER = env("WORKER_ID", `worker-${process.pid}`), LEASE = Number(env("LEASE_SECONDS", "300")), POLL = Number(env("POLL_SECONDS", "15"));
const WORK = env("WORK_DIR", "/tmp/vydora");
const BUCKET = "video-assets";
const db = createClient(URL_, KEY, { auth: { persistSession: false } });

const log = (job, message, level = "info") => db.from("render_job_events").insert({ job_id: job.id, user_id: job.user_id, level, message: String(message).slice(0, 2000) });
const update = (job, patch) => db.from("render_jobs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id).eq("locked_by", WORKER);

async function download(p, dest) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(p, 3600);
  if (error) throw new Error(`sign ${p}: ${error.message}`);
  const r = await fetch(data.signedUrl);
  if (!r.ok) throw new Error(`download ${p}: ${r.status}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

function upload(file, objectPath, size) {
  return new Promise((resolve, reject) => {
    const u = new tus.Upload(createReadStream(file), {
      endpoint: `${URL_}/storage/v1/upload/resumable`, uploadSize: size, chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 10000, 30000], removeFingerprintOnSuccess: true,
      headers: { authorization: `Bearer ${KEY}`, "x-upsert": "true" },
      metadata: { bucketName: BUCKET, objectName: objectPath, contentType: "video/mp4", cacheControl: "3600" },
      onError: reject, onSuccess: resolve,
    });
    u.start();
  });
}

async function process(job) {
  const dir = path.join(WORK, job.id);
  await mkdir(dir, { recursive: true });
  const beat = setInterval(() => db.rpc("heartbeat_render_job", { _job: job.id, _worker: WORKER, _lease_seconds: LEASE }).then(({ data }) => { if (data === false) lost = true; }), (LEASE * 1000) / 3);
  let lost = false;
  try {
    const { data: v } = await db.from("videos").select("*").eq("id", job.video_id).eq("user_id", job.user_id).single();
    if (!v) throw Object.assign(new Error("Video not found"), { permanent: true });
    const { data: rows } = await db.from("video_scenes").select("*").eq("video_id", v.id).order("position");
    if (!rows?.length) throw Object.assign(new Error("Video has no scenes"), { permanent: true });
    const missing = rows.filter((s) => !s.image_path && !s.clip_path).map((s) => s.position + 1);
    if (missing.length) throw Object.assign(new Error(`Scenes missing pictures: ${missing.join(", ")}`), { permanent: true });

    // Skip render if a previous attempt already uploaded the file (retry after crash).
    if (!job.output_path) {
      await update(job, { status: "rendering", progress: 2 });
      const scenes = [];
      for (const s of rows) {
        const ext = (p) => p.split(".").pop();
        scenes.push({
          image: s.image_path ? await download(s.image_path, path.join(dir, `img-${s.position}.${ext(s.image_path)}`)) : null,
          clip: s.clip_path ? await download(s.clip_path, path.join(dir, `clip-${s.position}.${ext(s.clip_path)}`)) : null,
          audio: s.audio_path ? await download(s.audio_path, path.join(dir, `aud-${s.position}.${ext(s.audio_path)}`)) : null,
          caption: s.narration,
        });
      }
      const musicFile = v.music_path ? await download(v.music_path, path.join(dir, "music." + v.music_path.split(".").pop())) : null;
      if (!v.music_path && v.music_enabled && v.music_mood !== "none") await log(job, "Mood music is composed in the browser and is not yet ported to the worker; rendered without it.", "warn");
      const logoFile = v.logo_path ? await download(v.logo_path, path.join(dir, "logo." + v.logo_path.split(".").pop())) : null;
      const { data: acct } = await db.rpc("effective_account", { _user: job.user_id });
      const out = path.join(dir, "out.mp4");
      let lastPct = 0;
      const meta = await renderVideo(scenes, v, { workDir: dir, out, musicFile, logoFile, watermark: !(acct?.pro || acct?.isAdmin),
        onProgress: (p) => { const pct = Math.round(5 + p * 80); if (pct - lastPct >= 5) { lastPct = pct; update(job, { progress: pct }); } } });
      if (lost) throw new Error("Lease lost; another worker owns this job");
      const size = (await stat(out)).size;
      const objectPath = `${job.user_id}/${v.id}/exports/worker-${job.id}.mp4`;
      await update(job, { status: "uploading", progress: 88 });
      await upload(out, objectPath, size);
      await update(job, { output_path: objectPath, size_bytes: size, progress: 92 });
      job.output_path = objectPath; job.size_bytes = size;
      await log(job, `Rendered ${meta.seconds.toFixed(1)} Seconds at ${meta.width}x${meta.height}, ${(size / 1048576).toFixed(1)} MB`);
    }

    if (job.publish && !job.youtube_video_id) {
      await update(job, { status: "uploading" });
      const id = await youtubeUpload(db, job, { bucket: BUCKET, worker: WORKER, log: (m) => log(job, m) });
      await update(job, { youtube_video_id: id });
    }
    await update(job, { status: "completed", progress: 100, completed_at: new Date().toISOString(), locked_by: null, locked_until: null });
    await log(job, "Completed");
  } catch (e) {
    console.error(job.id, e);
    await db.rpc("fail_render_job", { _job: job.id, _worker: WORKER, _error: String(e?.message ?? e), _retry: !e?.permanent });
  } finally {
    clearInterval(beat);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

let stopping = false;
for (const s of ["SIGTERM", "SIGINT"]) globalThis.process.on(s, () => { stopping = true; console.log("stopping after current job"); });

console.log(`Vydora worker ${WORKER} started`);
while (!stopping) {
  const { data, error } = await db.rpc("claim_render_job", { _worker: WORKER, _lease_seconds: LEASE });
  if (error) console.error("claim", error.message);
  const job = Array.isArray(data) ? data[0] : null;
  if (job) await process(job);
  else await new Promise((r) => setTimeout(r, POLL * 1000));
}
