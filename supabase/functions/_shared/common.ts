import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-lovable-aig-run-id, x-idempotency-key",
  "Access-Control-Expose-Headers": "X-Lovable-AIG-Run-ID",
};

export const GATEWAY_URL = "https://ai.gateway.lovable.dev";

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Returns a user-scoped client (RLS applies) and the signed-in user, or null. */
export async function getUserClient(req: Request) {
  const authHeader = req.headers.get("Authorization") ?? "";
  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { client, user: data.user };
}

export function adminClient() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

/** Shown when the AI service itself can't serve the request (workspace credits, policy block, outage).
 * Users can't fix these, so never show the owner-side remedy or the raw upstream text. */
export const AI_UNAVAILABLE = "Video creation is temporarily unavailable. Please try again in a few minutes — your credits are safe.";
export const AI_BUSY = "Too many requests right now — please wait a moment and try again.";

/** Statuses that mean the service (not the user) is at fault. */
export function aiServiceDown(status: number): boolean {
  return status === 401 || status === 402 || status === 403 || status >= 500;
}

/** Map gateway failures to a friendly message, preserving the status. */
export async function gatewayError(res: Response) {
  let raw = "";
  try {
    const body = await res.json();
    raw = String(body?.error?.message ?? body?.message ?? "");
  } catch { /* ignore */ }
  // Keep the real reason in the function logs for the owner; users only see the safe wording.
  console.error("gateway failure", res.status, raw.slice(0, 300));
  if (res.status === 429) return json({ error: AI_BUSY, code: "ai_busy" }, 429);
  if (aiServiceDown(res.status)) return json({ error: AI_UNAVAILABLE, code: "ai_unavailable" }, res.status);
  return json({ error: raw.slice(0, 300) || "The AI service could not complete this request." }, res.status);
}

/** Map an AI SDK (streamText) failure to a user-facing response. Null when the caller should handle it. */
export function aiSdkError(e: unknown): Response | null {
  const status = (e as { statusCode?: number })?.statusCode ?? 500;
  console.error("AI SDK failure", status, String((e as Error)?.message ?? e).slice(0, 300));
  if (status === 429) return json({ error: AI_BUSY, code: "ai_busy" }, 429);
  if (aiServiceDown(status)) return json({ error: AI_UNAVAILABLE, code: "ai_unavailable" }, status);
  return null;
}

async function hmac(msg: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("autopilot-task:" + (Deno.env.get("WORKER_SECRET") ?? "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Short-lived task token for one user, issued by worker-api only for an Autopilot run the worker holds. */
export async function signTask(userId: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return `${userId}.${exp}.${await hmac(`${userId}.${exp}`)}`;
}

/** Signed-in user, or an Autopilot task token (x-vydora-task) issued by worker-api. */
export async function getCaller(req: Request) {
  const task = req.headers.get("x-vydora-task");
  if (task) {
    const m = /^([0-9a-f-]{36})\.(\d{10})\.([0-9a-f]{64})$/i.exec(task);
    if (!m || !Deno.env.get("WORKER_SECRET") || Number(m[2]) < Date.now() / 1000) return null;
    const want = await hmac(`${m[1]}.${m[2]}`);
    let d = want.length ^ m[3].length; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ m[3].toLowerCase().charCodeAt(i);
    return d === 0 ? { client: adminClient(), user: { id: m[1] } as { id: string } } : null;
  }
  return getUserClient(req);
}
