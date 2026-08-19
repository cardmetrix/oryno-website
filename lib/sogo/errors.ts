import { publicServiceError, SERVICE_UNAVAILABLE } from "@/lib/service-errors";

const CODE_HINTS: Record<string, string> = {
  authentication_failed: "This service is temporarily unavailable.",
  authentication_required: "This service is temporarily unavailable.",
  invalid_scope: "This service is temporarily unavailable.",
  secret_key_required: "This service is temporarily unavailable.",
  environment_mismatch: "This service is temporarily unavailable.",
  insufficient_funds: SERVICE_UNAVAILABLE,
  validation_failed: "Check the details and try again.",
  idempotency_key_required: "Please try again.",
  verification_failed:
    "We could not verify that meter, smartcard, or account number.",
  rate_limit_exceeded: "Too many requests. Please wait a moment and try again.",
  service_unavailable:
    "This service is temporarily unavailable. Please try again soon.",
  gift_cards_unavailable:
    "The provider could not accept this gift card right now. Please try again shortly.",
  kyc_tier_insufficient:
    "This service is not fully set up yet. Please try again later.",
  kyb_verification_required:
    "This service is not fully set up yet. Please try again later.",
};

function firstFieldError(errors?: Record<string, string[] | string>) {
  if (!errors) return "";
  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && value[0]) return String(value[0]);
    if (typeof value === "string" && value) return value;
  }
  return "";
}

export function sogoErrorToEnglish(
  message: string,
  code?: string,
  errors?: Record<string, string[] | string>,
) {
  const field = firstFieldError(errors);
  if (field) return publicServiceError(field.slice(0, 220));

  const m = (message || "").toLowerCase();

  if (m.includes("not enabled on") && m.includes("gift card")) {
    return publicServiceError(message);
  }

  if (
    /not currently available via the partner api/.test(m) ||
    (code === "service_unavailable" && /gift.?card/.test(m))
  ) {
    return CODE_HINTS.gift_cards_unavailable;
  }

  if (code && CODE_HINTS[code]) return publicServiceError(CODE_HINTS[code]);

  if (!m) return "Something went wrong. Please try again.";

  if (m.includes("insufficient")) {
    return SERVICE_UNAVAILABLE;
  }
  if (m.includes("sogo") || m.includes("partner api")) {
    return "This service is temporarily unavailable. Please try again.";
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

  return publicServiceError(
    message
      .replace(/\bSogo\b/gi, "this service")
      .replace(/\bsogo\.africa\b/gi, "provider")
      .slice(0, 220),
  );
}

export function sogoHttpStatus(error: unknown) {
  const err = error as { status?: number; code?: string };
  if (err?.code === "insufficient_funds") return 422;
  const status = Number(err?.status);
  if ([400, 401, 403, 409, 422, 429, 503].includes(status)) return status;
  return 400;
}
