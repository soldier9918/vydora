// Hands-off Autopilot: lease one due run, perform its next bounded step by calling Vydora's normal
// generate-script / scene-asset functions with a short-lived task token, then report results.
// Credits are charged and refunded by those functions exactly as for manual creation.
import { api } from "./api.mjs";
const FN_BASE = String(process.env.VYDORA_API_URL).replace(/\/worker-api\/?$/, "");

async function call(fn, body, token) {
  try {
    const r = await fetch(`${FN_BASE}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", "x-vydora-task": token }, body: JSON.stringify(body), signal: AbortSignal.timeout(170_000) });
    const j = await r.json().catch(() => ({}));
    return { fn, status: r.status, videoId: j.videoId, error: j.error };
  } catch (e) { return { fn, status: 0, error: String(e?.message ?? e) }; }
}

/** Returns true if it did some work (so the loop polls again immediately). */
export async function autopilotTick() {
  const m = await api("autopilot_claim");
  if (m.queued) { console.log("autopilot: render queued", m.queued); return true; }
  if (!m.run) return false;
  console.log(`autopilot run ${m.run.id}: ${m.tasks.length} task(s)`);
  // Keep the lease alive while long script/asset steps run, so no other worker can take this run.
  const beat = setInterval(() => api("autopilot_heartbeat", { run: m.run.id }).catch(() => {}), 60_000);
  let results;
  try { results = await Promise.all(m.tasks.map((t) => call(t.fn, t.body, m.token))); } finally { clearInterval(beat); }
  await api("autopilot_result", { run: m.run.id, results });
  return true;
}
