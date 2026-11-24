/** Bounded diagnostic text; never persist URLs, credentials or entire error objects. */
export function exportFailureMessage(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "Export failed; no reason was provided.";
  return value
    .replace(/https?:\/\/\S+/gi, "[URL removed]")
    .replace(/\bBearer\s+\S+/gi, "[credential removed]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[credential removed]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim().slice(0, 1000);
}