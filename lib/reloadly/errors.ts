const CODE_HINTS: Record<string, string> = {
  INVALID_TOKEN: "Gift card service is temporarily unavailable.",
  UNAUTHORIZED: "Gift card service is temporarily unavailable.",
  INSUFFICIENT_BALANCE:
    "Unable to complete this purchase right now. Please try again shortly.",
};

export function reloadlyErrorToEnglish(message: string, code?: string) {
  if (code && CODE_HINTS[code]) return CODE_HINTS[code];
  const m = (message || "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";
  if (m.includes("reloadly") || m.includes("authentication")) {
    return "Gift card buying is temporarily unavailable. Please try again.";
  }
  if (m.includes("insufficient") || m.includes("balance")) {
    return "Unable to complete this purchase right now. Please try again shortly.";
  }
  if (m.includes("denomination") || m.includes("unitprice") || m.includes("price")) {
    return "That amount isn’t available for this card. Pick another value.";
  }
  if (m.includes("email")) {
    return "Enter a valid email to receive the gift card.";
  }
  return message.replace(/\bReloadly\b/gi, "gift card service").slice(0, 220);
}
