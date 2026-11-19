import { describe, expect, it } from "vitest";
import { joinSfx, parseSfx, sfxFor } from "./sfx";

describe("transition sounds", () => {
  it("smart match follows the music mood", () => {
    expect(sfxFor("auto@0=main", 0, "horror")).toBe("heartbeat");
    expect(sfxFor("auto@0=main", 0, "documentary")).toBe("page");
  });
  it("caption pop setting is kept alongside the chosen sound", () => {
    expect(parseSfx(joinSfx("riser", true))).toEqual({ type: "riser", textPop: true, overrides: {} });
    expect(sfxFor("riser@3=main+pop", 3)).toBe("riser");
  });
  it("a per-scene choice overrides the default sound for that scene change only", () => {
    const saved = joinSfx("whoosh", true, { 0: "main", 1: "impact", 2: "none" });
    expect(sfxFor(saved, 0)).toBe("whoosh");
    expect(sfxFor(saved, 1)).toBe("impact");
    expect(sfxFor(saved, 2)).toBe("none");
    expect(parseSfx(saved).textPop).toBe(true);
  });
  it("scene changes with no choice are silent by default", () => {
    expect(sfxFor("whoosh", 0)).toBe("none");
    expect(sfxFor(joinSfx("riser", false, { 1: "main" }), 4)).toBe("none");
  });
});
