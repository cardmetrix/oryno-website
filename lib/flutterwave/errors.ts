/** Flutterwave blocks API calls when the server IP is not whitelisted. */
export function isFlutterwaveIpWhitelistError(message?: string | null) {
  if (!message) return false;
  const value = message.toLowerCase();
  return (
    value.includes("ip whitelist") ||
    value.includes("whitelisting") ||
    value.includes("enable ip whitelisting") ||
    value.includes("contact your account administrator")
  );
}

/** Provider misconfiguration — not a real bank reversal. */
export function isProviderConfigError(message?: string | null) {
  return isFlutterwaveIpWhitelistError(message);
}

export function flutterwaveIpWhitelistSetupHint(egressIp?: string | null) {
  const ipLine = egressIp
    ? `Add this server IP in Flutterwave → Settings → Whitelisted IP addresses: ${egressIp}`
    : "Add your production server outbound IP in Flutterwave → Settings → Whitelisted IP addresses.";
  return `${ipLine} Do not use 0.0.0.0 unless Flutterwave support confirms it for your account. If you host on Vercel, enable Static IPs and whitelist those addresses. Also set FLUTTERWAVE_WEBHOOK_HASH so deposits credit automatically.`;
}

export function humanizeFlutterwaveSetupError(
  message?: string | null,
  egressIp?: string | null,
) {
  if (!isFlutterwaveIpWhitelistError(message)) return message || null;
  return flutterwaveIpWhitelistSetupHint(egressIp);
}

export const SERVICE_UNAVAILABLE_MESSAGE = "Service unavailable";

/** Customer-facing copy. Raw Flutterwave / proxy text stays in server logs only. */
export function isHiddenProviderError(message?: string | null) {
  if (!message) return false;
  const value = message.toLowerCase();
  return (
    value.includes("flutterwave") ||
    value.includes("flw_") ||
    isFlutterwaveIpWhitelistError(message) ||
    isFixieQuotaError(message) ||
    value.includes("proxy request failed") ||
    value.includes("secret key") ||
    value.includes("secret_key") ||
    value.includes("flutterwave_https_proxy") ||
    value.includes("payment provider blocked")
  );
}

export function publicPaymentError(
  message?: string | null,
  fallback = SERVICE_UNAVAILABLE_MESSAGE,
) {
  const text = (message || "").trim();
  if (!text) return fallback;
  if (isHiddenProviderError(text)) return SERVICE_UNAVAILABLE_MESSAGE;
  return text;
}

export const WITHDRAWAL_UNAVAILABLE_MESSAGE =
  "Withdrawal unavailable right now. Please try again shortly. Your money was returned to your ORYNO wallet.";

export const FIXIE_QUOTA_MESSAGE =
  "Withdrawals are paused because the Fixie proxy monthly request limit was reached. Upgrade the Fixie plan (or wait until the quota resets), then try again. Your money was returned to your ORYNO wallet.";

export function isFixieQuotaError(message?: string | null) {
  if (!message) return false;
  const value = message.toLowerCase();
  return (
    value.includes("monthly request quota exceeded") ||
    value.includes("quota exceeded") ||
    value.includes("request volume limit") ||
    (value.includes("407") && value.includes("proxy"))
  );
}

export function humanizeFlutterwaveTransferError(message?: string | null) {
  const detail = (message || "").trim();
  if (isFixieQuotaError(detail)) {
    return FIXIE_QUOTA_MESSAGE;
  }
  if (
    isFlutterwaveIpWhitelistError(message) ||
    /FLUTTERWAVE_HTTPS_PROXY is missing/i.test(detail) ||
    /FIXIE_URL is missing/i.test(detail) ||
    /proxy request failed/i.test(detail)
  ) {
    return WITHDRAWAL_UNAVAILABLE_MESSAGE;
  }
  return detail || "Withdrawal could not be sent to your bank.";
}

export function humanizeWalletRefundReason(message?: string | null) {
  if (isFixieQuotaError(message)) {
    return "Withdrawals paused (Fixie monthly request limit reached). Your money was returned to your ORYNO wallet — not to your bank account.";
  }
  if (isFlutterwaveIpWhitelistError(message)) {
    return "Withdrawal unavailable. Your money was returned to your ORYNO wallet — not to your bank account.";
  }

  const trimmed = (message || "").trim();
  if (!trimmed) {
    return "Your money was returned to your ORYNO wallet, not to your bank account.";
  }

  if (/oryno wallet/i.test(trimmed)) return trimmed;
  return `${trimmed} Your money was returned to your ORYNO wallet, not to your bank account.`;
}

export function humanizeDepositReverseReason(message?: string | null) {
  if (isFlutterwaveIpWhitelistError(message)) {
    return "This reversal was triggered by a provider configuration error, not a bank refund. Contact support if your wallet balance changed unexpectedly.";
  }

  const trimmed = (message || "").trim();
  if (!trimmed) {
    return "This deposit was reversed. Bank refunds are handled by your payment provider.";
  }

  return trimmed;
}
