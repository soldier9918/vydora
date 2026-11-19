import { adminClient, json } from "./common.ts";

// Must match src/lib/credits.ts CREDIT_COSTS.
export const COSTS = { script: 2, facts: 2, image: 3, voice: 2, animate: 25, thumbnail: 5, seo: 1, webCapture: 5 } as const;

/** Must match src/lib/credits.ts websiteScenes. */
export function websiteScenes(count: number): number[] {
  if (count < 4) return [count - 1].filter((n) => n >= 0);
  return [...new Set([Math.round(count * 0.3), Math.round(count * 0.5), Math.round(count * 0.65), count - 1])].sort((a, b) => a - b);
}

/** Atomically deducts credits (admins are free). Returns an error Response if the balance is too low. */
export async function charge(userId: string, amount: number, reason: string): Promise<Response | null> {
  if (amount <= 0) return null;
  const { data, error } = await adminClient().rpc("spend_credits", { _user: userId, _amount: amount, _reason: reason });
  if (error) { console.error("spend_credits", error); return json({ error: "Couldn't check your credit balance. Please try again." }, 500); }
  if (data === "insufficient") return json({ error: `You need ${amount} credits for this. Top up or subscribe on the Billing page.`, code: "insufficient_credits" }, 402);
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
