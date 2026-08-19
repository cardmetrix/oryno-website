/** User-facing copy when a service cannot be fulfilled (including low balance). */
export const SERVICE_UNAVAILABLE =
  "This service is unavailable. Please try again later.";

const HIDE_RE =
  /insufficient|not enough funds|no balance|balance too low|provider account has no|top up (the|your)/i;

/** Never show “insufficient” (wallet or provider) on service purchases. */
export function publicServiceError(message: unknown): string {
  const text = String(message ?? "").trim();
  if (!text) return SERVICE_UNAVAILABLE;
  if (HIDE_RE.test(text)) return SERVICE_UNAVAILABLE;
  return text;
}
