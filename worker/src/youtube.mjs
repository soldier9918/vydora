// Resumable YouTube upload. Vydora's backend creates the session and hands out short-lived access tokens;
// refresh tokens and client secrets never reach the worker. Session + offset are stored on the job so a
// restarted worker resumes instead of creating a second upload.
import { open } from "node:fs/promises";
import { api } from "./api.mjs";
const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB

async function token(jobId) {
  const t = await api("youtube_token", { job: jobId });
  return t.token;
}

async function readChunk(src, offset, end) {
  if (src.file) {
    const fh = await open(src.file, "r");
    try { const buf = Buffer.alloc(end - offset + 1); await fh.read(buf, 0, buf.length, offset); return buf; } finally { await fh.close(); }
  }
  const part = await fetch(src.url, { headers: { Range: `bytes=${offset}-${end}` } });
  if (!part.ok) throw new Error(`read output: ${part.status}`);
  return Buffer.from(await part.arrayBuffer());
}

export async function youtubeUpload(job, src, log) {
  const size = job.size_bytes;
  let { session } = await api("youtube_session", { job: job.id });
  let offset = 0;
  const q = await fetch(session, { method: "PUT", headers: { Authorization: `Bearer ${await token(job.id)}`, "Content-Range": `bytes */${size}` } });
  if (q.status === 200 || q.status === 201) return (await q.json()).id;
  if (q.status === 308) { const r = q.headers.get("Range"); offset = r ? Number(r.split("-")[1]) + 1 : 0; if (offset) await log(`Resuming YouTube upload at ${offset} bytes`); }
  else { await api("youtube_reset", { job: job.id }); ({ session } = await api("youtube_session", { job: job.id })); offset = 0; }
  while (offset < size) {
    const end = Math.min(size, offset + CHUNK) - 1;
    const body = await readChunk(src, offset, end);
    const put = await fetch(session, { method: "PUT", headers: { Authorization: `Bearer ${await token(job.id)}`, "Content-Length": String(body.length), "Content-Range": `bytes ${offset}-${end}/${size}` }, body });
    if (put.status === 200 || put.status === 201) return (await put.json()).id;
    if (put.status !== 308) throw new Error(`YouTube chunk failed: ${put.status}`);
    const r = put.headers.get("Range"); offset = r ? Number(r.split("-")[1]) + 1 : offset;
    await api("youtube_bytes", { job: job.id, bytes: offset });
  }
  throw new Error("YouTube upload ended without a video id");
}
