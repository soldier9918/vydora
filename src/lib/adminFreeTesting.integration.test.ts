import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const path = process.env.LOVABLE_TEST_SESSION_FILE;
describe.skipIf(!path)("admin Free rules against the real account service", () => {
  it("Free resets to zero, requires a simulated £5 top-up, retains eligibility until exhausted, and never changes real credits", async () => {
    if (!path) throw new Error("Signed-in admin session required");
    const token = JSON.parse(readFileSync(path, "utf8")).session?.access_token;
    const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    expect(authError).toBeNull();
    if (!user) throw new Error("Admin user required");
    const account = async () => {
      const { data, error } = await client.rpc("effective_account", { _user: user.id });
      expect(error).toBeNull();
      return data;
    };
    const initial = await account() as { adminAccess?: boolean; testMode?: string | null };
    expect(initial.adminAccess).toBe(true);
    const ledger = async () => {
      const { data, error } = await client.from("credit_ledger").select("id,amount,reason").eq("user_id", user.id).order("id");
      expect(error).toBeNull(); return data;
    };
    const before = await ledger();
    const mode = async (value: string) => { const { error } = await client.rpc("admin_set_test_mode", { _mode: value }); expect(error).toBeNull(); };
    const adjust = async (amount: number) => { const { error } = await client.rpc("admin_adjust_test_credits", { _amount: amount }); expect(error).toBeNull(); };
    try {
      await mode("free");
      expect(await account()).toMatchObject({ tier: "free", balance: 0, canGenerate: false, isAdmin: false, adminAccess: true });
      const { data: mutable, error } = await client.rpc("can_mutate_project", { _user_id: user.id });
      expect(error).toBeNull(); expect(mutable).toBe(false);
      const denied = await client.functions.invoke("suggest-topic", { body: {} });
      expect(denied.error?.context?.status).toBe(402);
      expect(await denied.error?.context?.json()).toMatchObject({ code: "payment_required" });
      await adjust(124);
      expect(await account()).toMatchObject({ balance: 124, canGenerate: false });
      await mode("free"); await adjust(125);
      expect(await account()).toMatchObject({ tier: "free", balance: 125, canGenerate: true, pro: false });
      await adjust(-117);
      expect(await account()).toMatchObject({ balance: 8, canGenerate: true });
      await adjust(-8);
      expect(await account()).toMatchObject({ balance: 0, canGenerate: false });
      await mode("admin");
      expect(await account()).toMatchObject({ isAdmin: true, canGenerate: true });
      expect(await ledger()).toEqual(before);
    } finally {
      await mode(initial.testMode ?? "admin");
    }
  }, 30000);
});