export function kenyaBillErrorToEnglish(raw: string) {
  const message = raw.trim() || "Kenya bill payment failed";
  if (/unauthorized|401|403|access denied|service not enabled/i.test(message)) {
    return "Reloadly Utilities is not enabled on this account. Turn on Utility Payments in the Reloadly dashboard, then use the same client ID and secret.";
  }
  if (/invalid_client|invalid client/i.test(message)) {
    return "Reloadly rejected the API keys. Check RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET.";
  }
  if (/biller|not found|unknown biller/i.test(message)) {
    return "This biller is not mapped yet. Set RELOADLY_BILLER_* IDs from Reloadly → Utilities → Billers, or retry after Utilities is enabled.";
  }
  if (/invalid|not found|unknown customer|meter|smartcard|subscriber/i.test(message)) {
    return "That account, meter, or smartcard number could not be verified.";
  }
  if (/insufficient|balance/i.test(message)) {
    return "Reloadly utilities balance is too low. Top up the Reloadly wallet.";
  }
  return message.slice(0, 220);
}

export function kenyaBillHttpStatus(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return 401;
  if (status === 422 || status === 400) return 400;
  if (typeof status === "number" && status >= 400 && status < 600) return status;
  return 400;
}

export const zaBillErrorToEnglish = kenyaBillErrorToEnglish;
export const zaBillHttpStatus = kenyaBillHttpStatus;
