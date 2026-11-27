import { beforeEach, describe, expect, it } from "vitest";
import { clearCreateDraft, CREATE_DRAFT_KEY, readCreateDraft, saveCreateDraft } from "./createDraft";

describe("visitor creation drafts", () => {
  beforeEach(() => sessionStorage.clear());
  it("preserves the idea and settings across signup and reload", () => {
    const draft = { topic: "Why stars shine", settings: { style: "Cinematic", scenes: "5", useFacts: true, speed: "1.2" } };
    expect(saveCreateDraft(draft)).toBe(true);
    expect(readCreateDraft()).toEqual(draft);
    expect(readCreateDraft()).toEqual(draft);
  });
  it("removes the saved draft after successful creation", () => {
    saveCreateDraft({ topic: "History of Rome", settings: {} });
    clearCreateDraft();
    expect(readCreateDraft()).toBeNull();
  });
  it("ignores malformed stored data", () => {
    sessionStorage.setItem(CREATE_DRAFT_KEY, "not-json");
    expect(readCreateDraft()).toBeNull();
    sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ topic: 12, settings: {} }));
    expect(readCreateDraft()).toBeNull();
  });
});