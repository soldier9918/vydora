// Resumable YouTube upload. The session URL and byte offset are stored on the job, so a restarted
// worker resumes instead of starting a second upload (no duplicate videos).
const CID = process.env.GOOGLE_YOUTUBE_CLIENT_ID ?? "", SECRET = process.env.GOOGLE_YOUTUBE_CLIENT_SECRET ?? "";
const CHUNK = 8 * 1024 * 1024; // multiple of 256 KiB

async function token(db, uid) {
  const { data: c } = await db.from("youtube_connections").select("*").eq("user_id", uid).maybeSingle();
  if (!c) throw Object.assign(new Error("YouTube channel not connected"), { permanent: true });
  if (new Date(c.expires_at).getTime() - 60_000 > Date.now()) return c.access_token;
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CID, client_secret: SECRET, refresh_token: c.refresh_token, grant_type: "refresh_token" }) });
  const t = await r.json();
  if (!r.ok || !t.access_token) throw Object.assign(new Error("YouTube access expired; please reconnect"), { permanent: t.error === "invalid_grant" });
  await db.from("youtube_connections").update({ access_token: t.access_token, expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() }).eq("user_id", uid);
  return t.access_token;
}

export async function youtubeUpload(db, job, { bucket, worker, log }) {
  const { data: v } = await db.from("videos").select("title, seo").eq("id", job.video_id).single();
  const seo = v?.seo ?? {};
  const tok = await token(db, job.user_id);
  const size = job.size_bytes;
  let session = job.youtube_session_url, offset = 0;
  if (session) {
    const q = await fetch(session, { method: "PUT", headers: { Authorization: `Bearer ${tok}`, "Content-Range": `bytes */${size}` } });
    if (q.status === 200 || q.status === 201) return (await q.json()).id;
    if (q.status === 308) { const r = q.headers.get("Range"); offset = r ? Number(r.split("-")[1]) + 1 : 0; await log(`Resuming YouTube upload at ${offset} bytes`); }
    else session = null; // expired session: start over (YouTube discards incomplete uploads)
  }
  if (!session) {
    const publishAt = job.publish_at && new Date(job.publish_at).getTime() > Date.now() + 5 * 60_000 ? new Date(job.publish_at).toISOString() : null;
    const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json", "X-Upload-Content-Type": "video/mp4", "X-Upload-Content-Length": String(size) },
      body: JSON.stringify({ snippet: { title: String(seo.title ?? v?.title ?? "Untitled").slice(0, 100), description: String(seo.description ?? "").slice(0, 5000), tags: Array.isArray(seo.tags) ? seo.tags.slice(0, 30) : [], categoryId: "22" },
        status: { privacyStatus: "private", ...(publishAt ? { publishAt } : {}), selfDeclaredMadeForKids: false, containsSyntheticMedia: true } }),
    });
    if (!init.ok) throw new Error(`YouTube refused upload: ${init.status} ${(await init.text()).slice(0, 300)}`);
    session = init.headers.get("Location");
    await db.from("render_jobs").update({ youtube_session_url: session, youtube_bytes_sent: 0 }).eq("id", job.id).eq("locked_by", worker);
  }
  const { data: signed } = await db.storage.from(bucket).createSignedUrl(job.output_path, 6 * 3600);
  while (offset < size) {
    const end = Math.min(size, offset + CHUNK) - 1;
    const part = await fetch(signed.signedUrl, { headers: { Range: `bytes=${offset}-${end}` } });
    const body = Buffer.from(await part.arrayBuffer());
    const put = await fetch(session, { method: "PUT", headers: { Authorization: `Bearer ${await token(db, job.user_id)}`, "Content-Length": String(body.length), "Content-Range": `bytes ${offset}-${end}/${size}` }, body });
    if (put.status === 200 || put.status === 201) return (await put.json()).id;
    if (put.status !== 308) throw new Error(`YouTube chunk failed: ${put.status}`);
    const r = put.headers.get("Range"); offset = r ? Number(r.split("-")[1]) + 1 : offset;
    await db.from("render_jobs").update({ youtube_bytes_sent: offset }).eq("id", job.id).eq("locked_by", worker);
  }
  throw new Error("YouTube upload ended without a video id");
}
