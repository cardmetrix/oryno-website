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
