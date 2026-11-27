export const CREATE_DRAFT_KEY = "vydora_create_draft";
export type CreateDraft = { topic: string; settings: Record<string, string | boolean> };

export function readCreateDraft(): CreateDraft | null {
  try {
    const raw = sessionStorage.getItem(CREATE_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    if (typeof draft.topic !== "string" || !draft.settings || typeof draft.settings !== "object" || Array.isArray(draft.settings)) return null;
    const settings: CreateDraft["settings"] = {};
    for (const [key, value] of Object.entries(draft.settings)) {
      if (typeof value === "string" || typeof value === "boolean") settings[key] = value;
    }
    return { topic: draft.topic, settings };
  } catch { return null; }
}

export function saveCreateDraft(draft: CreateDraft): boolean {
  try { sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(draft)); return true; }
  catch { return false; }
}

export function clearCreateDraft() {
  try { sessionStorage.removeItem(CREATE_DRAFT_KEY); } catch { /* Storage can be disabled. */ }
}