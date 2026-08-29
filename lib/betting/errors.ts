import { publicServiceError } from "@/lib/service-errors";

export function bettingErrorToEnglish(message: string) {
  const m = (message || "").toLowerCase();
  if (m.includes("insufficient")) {
    return "Insufficient wallet balance. Fund your wallet and try again.";
  }
  if (m.includes("verif") || m.includes("invalid customer") || m.includes("userid")) {
    return "We could not verify that betting account ID.";
  }
  if (m.includes("provider") && m.includes("unknown")) {
    return "That betting company is not available.";
  }
  if (m.includes("amount")) {
    return "Enter a valid funding amount.";
  }
  if (m.includes("nigeria") || m.includes("country")) {
    return "Betting funding is available for Nigeria accounts.";
  }
  if (m.includes("network") || m.includes("fetch") || m.includes("timeout")) {
    return "Network error. Check your connection and try again.";
  }
  return publicServiceError(message.slice(0, 220));
}

export function bettingHttpStatus(error: unknown) {
  const err = error as { status?: number; code?: string };
  if (err?.code === "insufficient_funds") return 422;
  const status = Number(err?.status);
  if ([400, 401, 403, 409, 422, 429, 503].includes(status)) return status;
  return 400;
}
