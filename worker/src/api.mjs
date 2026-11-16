// Thin client for the Vydora worker gateway. The worker holds only VYDORA_API_URL + WORKER_SECRET.
const URL_ = process.env.VYDORA_API_URL, SECRET = process.env.WORKER_SECRET;
if (!URL_ || !SECRET) throw new Error("Missing VYDORA_API_URL or WORKER_SECRET");
// Railway values are sometimes pasted with quotes, spaces or a trailing newline; strip them.
const rawId = String(process.env.WORKER_ID ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
export const WORKER = rawId || `worker-${process.pid}`;
if (!/^[A-Za-z0-9._:-]{1,64}$/.test(WORKER)) throw new Error(`WORKER_ID must be 1-64 letters, digits, . _ : - (got length ${WORKER.length})`);
export async function api(action, extra = {}) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: `Bearer ${SECRET}`, "Content-Type": "application/json" }, body: JSON.stringify({ action, worker: WORKER, ...extra }) });
  const body = await r.json().catch(() => ({}));
  if (r.status === 409) throw Object.assign(new Error("Lease lost; another worker owns this job"), { lost: true });
  if (!r.ok) throw Object.assign(new Error(`${action}: ${body.error ?? r.status}`), { permanent: body.permanent === true });
  return body;
}
