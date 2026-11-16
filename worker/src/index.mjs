// Vydora render worker: claims jobs through the worker gateway, renders with FFmpeg, uploads the MP4 to a
// one-time signed upload URL and optionally publishes to YouTube. No database or service keys here.
// Safe to restart: leases expire and jobs are reclaimed; finished uploads are never repeated.
import { mkdir, rm, writeFile, stat, readFile } from "node:fs/promises";
import path from "node:path";
import { renderVideo } from "./render.mjs";
import { youtubeUpload } from "./youtube.mjs";
import { api, WORKER } from "./api.mjs";
import { autopilotTick } from "./autopilot.mjs";

const POLL = Number(process.env.POLL_SECONDS ?? "15");
const WORK = process.env.WORK_DIR ?? "/tmp/vydora";

async function download(asset, dest) {
  if (!asset) return null;
  const r = await fetch(asset.url);
  if (!r.ok) throw new Error(`download failed: ${r.status}`);
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}

async function processJob(m) {
  const job = m.job, v = m.video;
  const dir = path.join(WORK, job.id);
  await mkdir(dir, { recursive: true });
  let lost = false;
  const beat = setInterval(() => api("heartbeat", { job: job.id }).then((r) => { if (!r.ok) lost = true; }).catch((e) => { if (e.lost) lost = true; }), (m.lease_seconds * 1000) / 3);
  const log = (message, level = "info") => api("progress", { job: job.id, message, level }).catch(() => {});
  const progress = (p, status) => api("progress", { job: job.id, progress: p, status }).catch(() => {});
  let localOut = null;
  try {
    if (!job.output_path) {
      await progress(2, "rendering");
      const scenes = [];
      for (const s of m.scenes) scenes.push({
        image: await download(s.image, path.join(dir, `img-${s.position}.${s.image?.ext}`)),
        clip: await download(s.clip, path.join(dir, `clip-${s.position}.${s.clip?.ext}`)),
        audio: await download(s.audio, path.join(dir, `aud-${s.position}.${s.audio?.ext}`)),
        caption: s.caption,
      });
      if (lost) throw Object.assign(new Error("Lease lost"), { lost: true });
      const musicFile = await download(m.music, path.join(dir, `music.${m.music?.ext}`));
      if (!m.music && v.music_enabled && v.music_mood !== "none") await log("Mood music is composed in the browser and is not yet ported to the worker; rendered without it.", "warn");
      const logoFile = await download(m.logo, path.join(dir, `logo.${m.logo?.ext}`));
      const out = path.join(dir, "out.mp4");
      let lastPct = 0;
      const meta = await renderVideo(scenes, v, { workDir: dir, out, musicFile, logoFile, watermark: m.watermark,
        onProgress: (p) => { const pct = Math.round(5 + p * 80); if (pct - lastPct >= 5) { lastPct = pct; progress(pct); } } });
      if (lost) throw Object.assign(new Error("Lease lost"), { lost: true });
      const size = (await stat(out)).size;
      await progress(88, "uploading");
      const put = await fetch(m.upload.url, { method: "PUT", headers: { "Content-Type": "video/mp4", "x-upsert": "true" }, body: await readFile(out) });
      if (!put.ok) throw new Error(`MP4 upload failed: ${put.status} ${(await put.text()).slice(0, 200)}`);
      const done = await api("uploaded", { job: job.id });
      job.output_path = m.upload.path; job.size_bytes = done.size_bytes; localOut = out;
      await log(`Rendered ${meta.seconds.toFixed(1)} Seconds at ${meta.width}x${meta.height}, ${(size / 1048576).toFixed(1)} MB`);
    }
    let youtubeId = job.youtube_video_id ?? undefined;
    if (job.publish && !youtubeId) {
      await progress(94, "uploading");
      youtubeId = await youtubeUpload(job, localOut ? { file: localOut } : { url: m.output.url }, log);
    }
    await api("complete", { job: job.id, youtube_video_id: youtubeId });
  } catch (e) {
    console.error(job.id, e?.message ?? e);
    if (!e?.lost) await api("fail", { job: job.id, error: String(e?.message ?? e), permanent: !!e?.permanent }).catch((x) => console.error("fail report", x.message));
  } finally {
    clearInterval(beat);
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

let stopping = false;
for (const s of ["SIGTERM", "SIGINT"]) process.on(s, () => { stopping = true; console.log("stopping after current job"); });
console.log(`Vydora worker ${WORKER} started`);
while (!stopping) {
  let m = null;
  try { m = await api("claim"); } catch (e) { console.error("claim", e.message); }
  if (m?.job) { await processJob(m); continue; }
  let worked = false;
  try { worked = await autopilotTick(); } catch (e) { console.error("autopilot", e.message); }
  if (!worked) await new Promise((r) => setTimeout(r, POLL * 1000));
}
