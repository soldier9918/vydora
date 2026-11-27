import { describe, expect, it, vi, beforeEach } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../supabase/functions/_shared/common.ts", () => ({
  adminClient: () => ({ rpc }),
  json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
}));
// Runtime import keeps Deno-only dependencies outside the browser TypeScript graph.
const creditModule = "../../supabase/functions/_shared/credits.ts";
const { charge, requireGeneration } = await import(/* @vite-ignore */ creditModule);

describe("payment before AI generation", () => {
  beforeEach(() => rpc.mockReset());
  it("blocks unpaid accounts before helpers can generate AI", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await requireGeneration("unpaid-user");
    expect(result?.status).toBe(402);
    expect(await result?.json()).toMatchObject({ code: "payment_required" });
    expect(rpc).toHaveBeenCalledWith("can_generate_ai", { _user: "unpaid-user" });
  });
  it("allows server-confirmed paid generation access", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await requireGeneration("paid-user")).toBeNull();
  });
  it("blocks a paid AI step even when an unpaid user holds legacy credits", async () => {
    rpc.mockResolvedValue({ data: "payment_required", error: null });
    const result = await charge("legacy-user", 2, "video_script");
    expect(result?.status).toBe(402);
    expect(await result?.json()).toMatchObject({ code: "payment_required" });
  });
  it("keeps zero-cost exports available without a payment check", async () => {
    expect(await charge("unpaid-user", 0, "video_export")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("fails closed if the account check fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
    expect((await requireGeneration("user"))?.status).toBe(500);
  });
  it("returns the required credits without starting an insufficient-balance action", async () => {
    rpc.mockResolvedValue({ data: "insufficient", error: null });
    const result = await charge("user", 25, "animate_scene");
    expect(result?.status).toBe(402);
    expect(await result?.json()).toMatchObject({ code: "insufficient_credits", required: 25 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("reserves an authenticated retry key before a paid AI action", async () => {
    rpc.mockResolvedValue({ data: "ok", error: null });
    const req = new Request("https://example.com", { headers: { "X-Idempotency-Key": "request-1" } });
    expect(await charge("user", 3, "scene_image", req)).toBeNull();
    expect(rpc).toHaveBeenCalledWith("reserve_ai_credits", { _user: "user", _amount: 3, _reason: "scene_image", _request_key: "scene_image:request-1" });
  });
  it("duplicate requests cannot proceed to paid AI work", async () => {
    rpc.mockResolvedValue({ data: "duplicate", error: null });
    const req = new Request("https://example.com", { headers: { "X-Idempotency-Key": "request-1" } });
    expect((await charge("user", 3, "scene_image", req))?.status).toBe(409);
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});