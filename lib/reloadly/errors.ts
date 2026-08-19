import { publicServiceError, SERVICE_UNAVAILABLE } from "@/lib/service-errors";

const CODE_HINTS: Record<string, string> = {
  INVALID_TOKEN: "Gift card service is temporarily unavailable.",
  UNAUTHORIZED: "Gift card service is temporarily unavailable.",
  INSUFFICIENT_BALANCE: SERVICE_UNAVAILABLE,
};

export function reloadlyErrorToEnglish(message: string, code?: string) {
  if (code && CODE_HINTS[code]) return publicServiceError(CODE_HINTS[code]);
  const m = (message || "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";

  if (m.includes("insufficient wallet")) {
    return SERVICE_UNAVAILABLE;
  }
  if (
    m.includes("insufficient balance from reloadly") ||
    m.includes("provider balance") ||
    m.includes("top up the reloadly") ||
    m.includes("top up your reloadly")
  ) {
    return SERVICE_UNAVAILABLE;
  }
  if (
    m.includes("access denied") ||
    m.includes("access_denied") ||
    m.includes("service not enabled") ||
    m.includes("invalid_client")
  ) {
    return "Gift card buying credentials don’t match this environment. Check Reloadly sandbox/live keys, or set RELOADLY_DEMO=true.";
  }
  if (m.includes("authentication") || m.includes("invalid_token")) {
    return "Gift card buying is temporarily unavailable. Please try again.";
  }
  if (m.includes("insufficient") || m.includes("balance too low")) {
    return SERVICE_UNAVAILABLE;
  }
  if (
    m.includes("denomination") ||
    m.includes("unitprice") ||
    m.includes("unit price")
  ) {
    return "That amount isn’t available for this card. Pick another value.";
  }
  if (m.includes("email")) {
    return "Enter a valid email to receive the gift card.";
  }
  return publicServiceError(
    message.replace(/\bReloadly\b/gi, "gift card service").slice(0, 220),
  );
}

export function reloadlyBuyHttpStatus(message: string) {
  const m = (message || "").toLowerCase();
  if (m.includes("unauthorized")) return 401;
  if (m.includes("insufficient")) return 422;
  return 400;
}
