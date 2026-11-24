import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

describe("failed export report access", () => {
  it("does not expose user failure records to an anonymous visitor", async () => {
    const client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await client.rpc("admin_failed_exports", { _limit: 1 });
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});