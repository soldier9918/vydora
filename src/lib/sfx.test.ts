import { describe, expect, it } from "vitest";
import { joinSfx, parseSfx, sfxFor } from "./sfx";

describe("transition sounds", () => {
  it("smart match follows the music mood", () => {
    expect(sfxFor("auto", 0, "horror")).toBe("heartbeat");
    expect(sfxFor("auto", 0, "documentary")).toBe("page");
  });
  it("caption pop setting is kept alongside the chosen sound", () => {
    expect(parseSfx(joinSfx("riser", true))).toEqual({ type: "riser", textPop: true });
    expect(sfxFor("riser+pop", 3)).toBe("riser");
  });
});
