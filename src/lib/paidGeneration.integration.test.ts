import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sessionPath = process.env.LOVABLE_TEST_SESSION_FILE;
const token: string | undefined = sessionPath ? JSON.parse(readFileSync(sessionPath, "utf8")).session?.access_token : undefined;
const signedClient = token ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false },
}) : null;
describe.skipIf(!signedClient)("paid-generation policy boundaries", () => {
  const cases = [
    { name: "0 free generations: unpaid accounts are blocked", admin: false, subscription: false, credits: 0, expected: false },
    { name: "less than £5 (124 credits) does not qualify", admin: false, subscription: false, credits: 124, expected: false },
    { name: "£5 (125 credits) qualifies", admin: false, subscription: false, credits: 125, expected: true },
    { name: "larger top-ups qualify", admin: false, subscription: false, credits: 250, expected: true },
    { name: "paid subscriptions qualify without a top-up", admin: false, subscription: true, credits: 0, expected: true },
    { name: "admin access stays untouched", admin: true, subscription: false, credits: 0, expected: true },
  ];
  for (const c of cases) it(c.name, async () => {
    if (!signedClient) throw new Error("Signed-in test session required");
    const { data, error } = await signedClient.rpc("ai_payment_eligible", {
      _admin: c.admin, _paid_subscription: c.subscription, _topup_credits: c.credits,
    });
    expect(error).toBeNull();
    expect(data).toBe(c.expected);
  });
});
// Use an anonymous client for access-denial checks; signed-in policy boundary checks
// are also exercised by the browser flow without creating payments or changing balances.
describe("generation access privacy", () => {
  it("anonymous visitors cannot check another account's generation eligibility", async () => {
    const { data, error } = await client.rpc("can_generate_ai", { _user: "00000000-0000-0000-0000-000000000001" });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe.skipIf(!signedClient)("safe legacy free-credit removal", () => {
  const cases = [
    { name: "unused signup credits can be removed", balance: 30, free: 30, mixed: false, protected: false, expected: 30 },
    { name: "spent signup credits are not deducted again", balance: 3, free: 30, mixed: false, protected: false, expected: 3 },
    { name: "mixed purchased credits stay untouched", balance: 155, free: 30, mixed: true, protected: false, expected: 0 },
    { name: "administrator promotions stay untouched", balance: 80, free: 30, mixed: true, protected: false, expected: 0 },
    { name: "paid subscriber balances stay untouched", balance: 600, free: 30, mixed: false, protected: true, expected: 0 },
    { name: "zero balances never become negative", balance: 0, free: 30, mixed: false, protected: false, expected: 0 },
    { name: "unclassified excess balances need review", balance: 31, free: 30, mixed: false, protected: false, expected: 0 },
  ];
  for (const c of cases) it(c.name, async () => {
    if (!signedClient) throw new Error("Signed-in test session required");
    const {data,error}=await signedClient.rpc("free_credit_removal_amount",{_balance:c.balance,_free:c.free,_mixed:c.mixed,_protected:c.protected});
    expect(error).toBeNull();
    expect(data).toBe(c.expected);
  });
});