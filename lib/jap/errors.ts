import { publicServiceError, SERVICE_UNAVAILABLE } from "@/lib/service-errors";

/**
 * Map Famsup / SMM panel errors to clear English for the UI.
 * Never expose the provider brand name.
 */
const JAP_ERROR_EN: Record<string, string> = {
  "not enough funds": SERVICE_UNAVAILABLE,
  "neworder.error.not_enough_funds": SERVICE_UNAVAILABLE,
  "incorrect service id": "This boost package isn’t available. Pick another one.",
  "incorrect service": "This boost package isn’t available. Pick another one.",
  "neworder.error.incorrect_service_id":
    "This boost package isn’t available. Pick another one.",
  "incorrect link": "Enter a valid profile or post link.",
  "neworder.error.incorrect_link": "Enter a valid profile or post link.",
  "bad link": "Enter a valid profile or post link.",
  "quantity less than minimal":
    "Quantity is too low for this package. Increase it and try again.",
  "quantity more than maximal":
    "Quantity is too high for this package. Lower it and try again.",
  "neworder.error.quantity": "Enter a valid quantity for this package.",
  "not authenticated":
    "Boost service credentials are invalid. Contact ORYNO support.",
  "incorrect api key":
    "Boost service credentials are invalid. Contact ORYNO support.",
  "wrong api key":
    "Boost service credentials are invalid. Contact ORYNO support.",
  "api key disabled":
    "Boost service credentials are invalid. Contact ORYNO support.",
};

export function japErrorToEnglish(raw: unknown): string {
  const text = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return "Something went wrong. Please try again.";

  const lower = text.toLowerCase();
  if (JAP_ERROR_EN[lower]) return publicServiceError(JAP_ERROR_EN[lower]);

  for (const [key, en] of Object.entries(JAP_ERROR_EN)) {
    if (lower.includes(key)) return publicServiceError(en);
  }

  return publicServiceError(
    text
      .replace(/JustAnotherPanel/gi, "ORYNO")
      .replace(/justanotherpanel/gi, "oryno")
      .replace(/famsup/gi, "ORYNO")
      .replace(/\bJAP\b/g, "ORYNO"),
  );
}
