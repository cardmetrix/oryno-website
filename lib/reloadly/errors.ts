import { publicServiceError, SERVICE_UNAVAILABLE } from "@/lib/service-errors";

const CODE_HINTS: Record<string, string> = {
  INVALID_TOKEN: "Gift card service is temporarily unavailable.",
  UNAUTHORIZED: "Gift card service is temporarily unavailable.",
  INSUFFICIENT_BALANCE: SERVICE_UNAVAILABLE,
};

export type ReloadlyBuyErrorCode =
  | "USER_WALLET"
  | "PROVIDER_BALANCE"
  | "OUT_OF_STOCK"
  | "BAD_AMOUNT"
  | "BAD_EMAIL"
  | "AUTH"
  | "UNAVAILABLE"
  | "UNKNOWN";

export function reloadlyBuyErrorCode(message: string): ReloadlyBuyErrorCode {
  const m = (message || "").toLowerCase();
  if (m.includes("insufficient wallet") || m.includes("user_wallet")) {
    return "USER_WALLET";
  }
  if (
    m.includes("provider_balance") ||
    m.includes("insufficient balance from reloadly") ||
    m.includes("top up the reloadly") ||
    m.includes("top up your reloadly") ||
    (m.includes("insufficient") && m.includes("reloadly")) ||
    m.includes("provider balance")
  ) {
    return "PROVIDER_BALANCE";
  }
  if (m.includes("out of stock") || m.includes("not in stock")) {
    return "OUT_OF_STOCK";
  }
  if (
    m.includes("denomination") ||
    m.includes("unitprice") ||
    m.includes("unit price") ||
    m.includes("amount is not valid") ||
    m.includes("invalid amount") ||
    m.includes("isn’t available for this card") ||
    m.includes("isn't available for this card")
  ) {
    return "BAD_AMOUNT";
  }
  if (m.includes("email") || m.includes("recipient")) {
    return "BAD_EMAIL";
  }
  if (
    m.includes("access denied") ||
    m.includes("access_denied") ||
    m.includes("invalid_client") ||
    m.includes("authentication") ||
    m.includes("invalid_token")
  ) {
    return "AUTH";
  }
  if (
    m.includes("temporarily unavailable") ||
    m.includes("try again later") ||
    m.includes("not configured")
  ) {
    return "UNAVAILABLE";
  }
  if (m.includes("insufficient") || m.includes("balance too low")) {
    return "PROVIDER_BALANCE";
  }
  return "UNKNOWN";
}

export function reloadlyErrorToEnglish(message: string, code?: string) {
  if (code && CODE_HINTS[code]) return publicServiceError(CODE_HINTS[code]);
  const m = (message || "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";

  const kind = reloadlyBuyErrorCode(message);

  if (kind === "USER_WALLET") {
    return "Insufficient wallet balance. Fund your wallet and try again.";
  }
  if (kind === "PROVIDER_BALANCE") {
    // User-facing: don't expose provider account details.
    return "Gift card buying is temporarily unavailable. Please try again later.";
  }
  if (kind === "OUT_OF_STOCK") {
    return "This gift card is out of stock. Try another brand or amount.";
  }
  if (kind === "BAD_AMOUNT") {
    return "That amount isn’t available for this card. Pick another value.";
  }
  if (
    m.includes("countrycode") ||
    m.includes("country code") ||
    m.includes("invalid country")
  ) {
    return "This gift card isn’t available for that country right now.";
  }
  if (kind === "BAD_EMAIL") {
    return "Enter a valid email to receive the gift card.";
  }
  if (m.includes("sendername") || m.includes("sender name")) {
    return "Sender name was rejected. Please try again.";
  }
  if (kind === "AUTH") {
    return "Gift card buying credentials don’t match this environment. Check Reloadly sandbox/live keys.";
  }
  if (kind === "UNAVAILABLE") {
    return "Gift card buying is temporarily unavailable. Please try again later.";
  }

  return publicServiceError(
    message.replace(/\bReloadly\b/gi, "gift card service").slice(0, 220),
  );
}

export function reloadlyBuyHttpStatus(message: string) {
  const kind = reloadlyBuyErrorCode(message);
  if (kind === "AUTH") return 401;
  if (
    kind === "USER_WALLET" ||
    kind === "PROVIDER_BALANCE" ||
    kind === "OUT_OF_STOCK" ||
    kind === "UNAVAILABLE"
  ) {
    return 422;
  }
  return 400;
}
