// Wording for when the AI service itself can't serve a request (out of workspace credits,
// a policy block, or an outage). Users can't fix any of those, so the real reason stays in
// server logs and only this safe wording reaches the screen.
export const AI_UNAVAILABLE_MESSAGE =
  "Video creation is temporarily unavailable. Please try again in a few minutes — your credits are safe.";

/** True when a failed action was the service being down, not something the user did wrong. */
export function isAiUnavailable(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "ai_unavailable";
}

/** True when the service asked us to slow down and a short wait is the fix. */
export function isAiBusy(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === "ai_busy";
}

/**
 * The message to show for a failed AI action. Service-down failures always show the safe
 * wording even if something else put a different string on the error.
 */
export function aiFailureMessage(err: unknown): string {
  if (isAiUnavailable(err)) return AI_UNAVAILABLE_MESSAGE;
  return (err as Error)?.message || "Something went wrong. Please try again.";
}
