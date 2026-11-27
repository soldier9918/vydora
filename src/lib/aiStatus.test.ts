import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AI_UNAVAILABLE_MESSAGE, aiFailureMessage, isAiBusy, isAiUnavailable } from "./aiStatus";

const root = process.cwd();
const fn = (name: string) => readFileSync(join(root, "supabase/functions", name, "index.ts"), "utf8");
const shared = readFileSync(join(root, "supabase/functions/_shared/common.ts"), "utf8");
const AI_FNS = ["generate-script", "generate-seo", "rewrite-scene", "edit-scenes", "scene-asset", "generate-thumbnail", "animate-scene", "voice-sample", "suggest-topic", "generate-series"];

describe("temporarily unavailable wording", () => {
  it("service-down failures show the safe wording, never the owner-side remedy", () => {
    const err = Object.assign(new Error("Workspace out of AI credits"), { code: "ai_unavailable" });
    expect(aiFailureMessage(err)).toBe(AI_UNAVAILABLE_MESSAGE);
    expect(aiFailureMessage(err)).not.toMatch(/workspace|Settings/i);
  });

  it("recognises only the service-down code", () => {
    expect(isAiUnavailable(Object.assign(new Error("x"), { code: "ai_unavailable" }))).toBe(true);
    expect(isAiUnavailable(Object.assign(new Error("x"), { code: "ai_busy" }))).toBe(false);
    expect(isAiUnavailable(Object.assign(new Error("x"), { code: "insufficient_credits" }))).toBe(false);
    expect(isAiUnavailable(new Error("x"))).toBe(false);
    expect(isAiUnavailable(null)).toBe(false);
    expect(isAiUnavailable(undefined)).toBe(false);
  });

  it("keeps the user's own problem messages unchanged", () => {
    expect(aiFailureMessage(Object.assign(new Error("You need 32 credits for this."), { code: "insufficient_credits" })))
      .toBe("You need 32 credits for this.");
    expect(aiFailureMessage(new Error("Please sign in first."))).toBe("Please sign in first.");
    expect(aiFailureMessage(null)).toBe("Something went wrong. Please try again.");
  });

  it("busy is a different code from down", () => {
    expect(isAiBusy(Object.assign(new Error("x"), { code: "ai_busy" }))).toBe(true);
    expect(isAiBusy(Object.assign(new Error("x"), { code: "ai_unavailable" }))).toBe(false);
  });

  it("no AI function sends the owner-side credit remedy to users", () => {
    for (const f of AI_FNS) {
      expect(fn(f), f).not.toMatch(/workspace is out of AI credits|Settings → Plans/);
    }
  });

  it("gateway and SDK failures both map to the safe wording", () => {
    expect(shared).toMatch(/export const AI_UNAVAILABLE =/);
    expect(shared).toMatch(/export function aiSdkError/);
    expect(shared).toMatch(/export function aiServiceDown/);
    expect(shared).toMatch(/if \(aiServiceDown\(res\.status\)\) return json\(\{ error: AI_UNAVAILABLE/);
    expect(shared).toMatch(/if \(aiServiceDown\(status\)\) return json\(\{ error: AI_UNAVAILABLE/);
  });

  it("server and client use the same wording", () => {
    const m = shared.match(/export const AI_UNAVAILABLE = "([^"]+)"/);
    expect(m?.[1]).toBe(AI_UNAVAILABLE_MESSAGE);
  });

  it("every AI function routes failures through the shared helper", () => {
    for (const f of AI_FNS) {
      const src = fn(f);
      expect(src, f).toMatch(/gatewayError|aiSdkError/);
    }
  });

});
