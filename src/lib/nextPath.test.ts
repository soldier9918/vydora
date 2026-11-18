import { describe, it, expect } from "vitest";
import { safeNext } from "./nextPath";
describe("after sign-in destination", () => {
  it("keeps the page the visitor wanted", () => expect(safeNext("/from-url")).toBe("/from-url"));
  it("rejects other websites", () => { expect(safeNext("//evil.com")).toBeNull(); expect(safeNext("https://evil.com")).toBeNull(); expect(safeNext("/\\evil.com")).toBeNull(); });
  it("ignores missing values and the sign-in page itself", () => { expect(safeNext(null)).toBeNull(); expect(safeNext("/auth")).toBeNull(); });
});
