import { adminClient, json } from "./common.ts";

// Must match src/lib/credits.ts CREDIT_COSTS.
export const COSTS = { script: 2, facts: 2, image: 3, voice: 2, animate: 25, thumbnail: 5, seo: 1, webCapture: 5 } as const;

export const PAYMENT_REQUIRED = "Your account doesn't have enough credits to complete this action. Purchase credits starting from £5 or choose a subscription plan to start creating AI videos.";
const paymentRequired = () => json({ error: PAYMENT_REQUIRED, code: "payment_required" }, 402);

/** Check before uncharged AI helpers or generating an uncached narrator sample. */
export async function requireGeneration(userId: string): Promise<Response | null> {
  const { data, error } = await adminClient().rpc("can_generate_ai", { _user: userId });
  if (error) return json({ error: "Couldn't check your account. Please try again." }, 500);
  return data === true ? null : paymentRequired();
}

/** Must match src/lib/credits.ts websiteScenes. */
export function websiteScenes(count: number): number[] {
  if (count < 4) return [count - 1].filter((n) => n >= 0);
  return [...new Set([Math.round(count * 0.3), Math.round(count * 0.5), Math.round(count * 0.65), count - 1])].sort((a, b) => a - b);
}

/** Atomically deducts credits (admins are free). Returns an error Response if the balance is too low. */
export async function charge(userId: string, amount: number, reason: string, request?: Request): Promise<Response | null> {
  if (amount <= 0) return null;
  const key = request?.headers.get("X-Idempotency-Key");
  if (key && !/^[a-zA-Z0-9_-]{1,160}$/.test(key)) return json({ error: "Invalid request key." }, 400);
  const args = { _user: userId, _amount: amount, _reason: reason };
  const { data, error } = key
    ? await adminClient().rpc("reserve_ai_credits", { ...args, _request_key: `${reason}:${key}` })
    : await adminClient().rpc("spend_credits", args);
  if (error) { console.error("spend_credits", error); return json({ error: "Couldn't check your credit balance. Please try again." }, 500); }
  if (data === "duplicate") return json({ error: "This request has already been handled. Refresh your video before trying again.", code: "duplicate_request" }, 409);
  if (data === "payment_required") return paymentRequired();
  if (data === "insufficient") return json({ error: PAYMENT_REQUIRED, code: "insufficient_credits", required: amount }, 402);
  return null;
}

/** Gives credits back when the AI step failed after charging. */
export async function refund(userId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const { error } = await adminClient().rpc("refund_credits", { _user: userId, _amount: amount, _reason: reason });
  if (error) console.error("refund_credits", error);
}

/** Server-side read-only check (DB `can_mutate_project`). Returns a 402 Response when the project is locked. */
export async function requireMutable(userId: string): Promise<Response | null> {
  const { data, error } = await adminClient().rpc("can_mutate_project", { _user_id: userId });
  if (error) { console.error("can_mutate_project", error); return json({ error: "Couldn't check your account. Please try again." }, 500); }
  if (data !== true) return json({ error: "You've used all your credits, but your video is still available to preview and download. Add credits to unlock editing and continue creating.", code: "read_only" }, 402);
  return null;
}
