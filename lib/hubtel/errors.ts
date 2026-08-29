export function hubtelErrorToEnglish(raw: string) {
  const message = raw.trim() || "Ghana bill payment failed";
  if (/unauthorized|401|403|access denied/i.test(message)) {
    return "Hubtel rejected the API keys. Check HUBTEL_CLIENT_ID and HUBTEL_CLIENT_SECRET.";
  }
  if (/prepaid|account id|pos/i.test(message) && /missing|required|invalid/i.test(message)) {
    return "Set HUBTEL_POS_ACCOUNT_ID from Hubtel → Money → Accounts.";
  }
  if (/service.?id|not subscribed|commission/i.test(message)) {
    return "This bill is not enabled on your Hubtel commission-services account yet. Subscribe in the Hubtel dashboard, then paste the service ID into .env.";
  }
  if (/invalid|not found|unknown customer|meter|smartcard|iuc/i.test(message)) {
    return "That account, meter, or smartcard number could not be verified.";
  }
  if (/insufficient|balance/i.test(message)) {
    return "Hubtel prepaid balance is too low. Top up the Hubtel deposit account.";
  }
  return message.slice(0, 220);
}

export function hubtelHttpStatus(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return 401;
  if (status === 422 || status === 400) return 400;
  if (typeof status === "number" && status >= 400 && status < 600) return status;
  return 400;
}
