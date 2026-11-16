# Vydora render worker (Stage 1 proof of concept)

Renders a saved Vydora video with FFmpeg from cloud-stored assets — no browser. Jobs come from the
`render_jobs` table (lease-based claim, heartbeat, automatic retry with backoff, refund-once on final failure).

## Railway setup
1. Railway account on the **Hobby plan ($5/month, includes $5 usage)**.
2. New Project -> Deploy from GitHub repo -> pick this repo, set **Root Directory = `worker`** (Dockerfile is detected).
3. Variables: `VYDORA_API_URL` and `WORKER_SECRET` only (see `.env.example`). The worker never holds database, storage or Google keys; it talks only to the `worker-api` gateway, which hands out per-job signed URLs.
4. Resources: 2 vCPU / 2 GB RAM is enough for 1080p. Set replicas = 1 for now.

## Queue a test
Call the `render-job` function as an admin with `{ "videoId": "<id>" }`, then close the browser.
The MP4 lands in `video-assets/<user>/<video>/exports/worker-<job>.mp4`; progress in `render_jobs` / `render_job_events`.

## Not yet ported (renders without them, logged as a warning)
Mood music composed in the browser (uploaded music works), horror overlay effects, sound effects, intro/outro cards,
exact typewriter letter animation (captions fade in per phrase).
