const CODE_HINTS: Record<string, string> = {
  authentication_failed: "Gift card service is temporarily unavailable.",
  authentication_required: "Gift card service is temporarily unavailable.",
  invalid_scope: "Gift card service is temporarily unavailable.",
  secret_key_required: "Gift card service is temporarily unavailable.",
  environment_mismatch: "Gift card service is temporarily unavailable.",
  insufficient_funds:
    "Unable to process this trade right now. Please try again shortly.",
  validation_failed: "Check your card details and try again.",
  rate_limit_exceeded: "Too many requests. Please wait a moment and try again.",
  service_unavailable:
    "Gift card trading is temporarily unavailable. Please try again soon.",
  kyc_tier_insufficient:
    "Gift card trading is not fully set up yet. Please try again later.",
  kyb_verification_required:
    "Gift card trading is not fully set up yet. Please try again later.",
};

export function sogoErrorToEnglish(message: string, code?: string) {
  if (code && CODE_HINTS[code]) return CODE_HINTS[code];

  const m = (message || "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";

  if (m.includes("sogo") || m.includes("partner api")) {
    return "Gift card trading is temporarily unavailable. Please try again.";
  }
  if (m.includes("insufficient")) {
    return "Unable to process this trade right now. Please try again shortly.";
  }
  if (m.includes("validation") || m.includes("invalid")) {
    return "Check your card details and try again.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  // Strip provider branding from user-facing copy
  return message
    .replace(/\bSogo\b/gi, "gift card service")
    .replace(/\bsogo\.africa\b/gi, "provider")
    .slice(0, 220);
}
