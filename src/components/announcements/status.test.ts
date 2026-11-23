import { describe, it, expect } from "vitest";
import { statusOf } from "./AdminAnnouncementsPanel";
const now = Date.parse("2026-11-23T12:00:00Z");
describe("announcement status", () => {
  it("paused when switched off", () => expect(statusOf({ is_active: false, starts_at: null, ends_at: null }, now)).toBe("Paused"));
  it("scheduled before start", () => expect(statusOf({ is_active: true, starts_at: "2026-11-24T00:00:00Z", ends_at: null }, now)).toBe("Scheduled"));
  it("expired after end", () => expect(statusOf({ is_active: true, starts_at: null, ends_at: "2026-11-22T00:00:00Z" }, now)).toBe("Expired"));
  it("live inside window", () => expect(statusOf({ is_active: true, starts_at: "2026-11-22T00:00:00Z", ends_at: "2026-11-24T00:00:00Z" }, now)).toBe("Live now"));
});
