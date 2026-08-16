const CODE_HINTS: Record<string, string> = {
  authentication_failed: "This service is temporarily unavailable.",
  authentication_required: "This service is temporarily unavailable.",
  invalid_scope: "This service is temporarily unavailable.",
  secret_key_required: "This service is temporarily unavailable.",
  environment_mismatch: "This service is temporarily unavailable.",
  insufficient_funds:
    "Unable to process this request right now. Please try again shortly.",
  validation_failed: "Check the details and try again.",
  verification_failed:
    "We could not verify that meter, smartcard, or account number.",
  rate_limit_exceeded: "Too many requests. Please wait a moment and try again.",
  service_unavailable:
    "This service is temporarily unavailable. Please try again soon.",
  kyc_tier_insufficient:
    "This service is not fully set up yet. Please try again later.",
  kyb_verification_required:
    "This service is not fully set up yet. Please try again later.",
};

export function sogoErrorToEnglish(message: string, code?: string) {
  if (code && CODE_HINTS[code]) return CODE_HINTS[code];

  const m = (message || "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";

  if (m.includes("sogo") || m.includes("partner api")) {
    return "This service is temporarily unavailable. Please try again.";
  }
  if (m.includes("insufficient")) {
    return "Unable to process this request right now. Please try again shortly.";
  }
  if (m.includes("verif")) {
    return "We could not verify that meter, smartcard, or account number.";
  }
  if (m.includes("validation") || m.includes("invalid")) {
    return "Check the details and try again.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Network error. Check your connection and try again.";
  }

  // Strip provider branding from user-facing copy
  return message
    .replace(/\bSogo\b/gi, "this service")
    .replace(/\bsogo\.africa\b/gi, "provider")
    .slice(0, 220);
}
