// Thin client for the Vydora worker gateway. The worker holds only VYDORA_API_URL + WORKER_SECRET.
const URL_ = process.env.VYDORA_API_URL, SECRET = process.env.WORKER_SECRET;
if (!URL_ || !SECRET) throw new Error("Missing VYDORA_API_URL or WORKER_SECRET");
export const WORKER = process.env.WORKER_ID ?? `worker-${process.pid}`;
export async function api(action, extra = {}) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, worker: WORKER, ...extra }) });
  const body = await r.json().catch(() => ({}));
  if (r.status === 409) throw Object.assign(new Error("Lease lost; another worker owns this job"), { lost: true });
  if (!r.ok) throw Object.assign(new Error(`${action}: ${body.error ?? r.status}`), { permanent: body.permanent === true });
  return body;
}
