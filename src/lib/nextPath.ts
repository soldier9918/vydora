const KEY = "vydora_next_path";

/** Only same-site paths like "/from-url" are allowed, never "//evil.com" or full URLs. */
export const safeNext = (p: string | null | undefined): string | null =>
  p && p.startsWith("/") && !p.startsWith("//") && !p.startsWith("/\\") && !p.startsWith("/auth") ? p : null;

export const rememberNext = (p: string | null) => { const s = safeNext(p); if (s) sessionStorage.setItem(KEY, s); };
export const takeNext = (): string | null => { const s = safeNext(sessionStorage.getItem(KEY)); sessionStorage.removeItem(KEY); return s; };
