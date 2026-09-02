/** Flutterwave blocks API calls when the server IP is not whitelisted. */
export function isFlutterwaveIpWhitelistError(message?: string | null) {
  if (!message) return false;
  const value = message.toLowerCase();
  return (
    value.includes("ip whitelist") ||
    value.includes("whitelisting") ||
    value.includes("enable ip whitelisting")
  );
}

/** Provider misconfiguration — not a real bank reversal. */
export function isProviderConfigError(message?: string | null) {
  return isFlutterwaveIpWhitelistError(message);
}

export function humanizeWalletRefundReason(message?: string | null) {
  if (isFlutterwaveIpWhitelistError(message)) {
    return "Payment provider blocked the transfer from our server. Your money was returned to your ORYNO wallet — not to your bank account.";
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
