/**
 * Paid purchases must never fake-complete. Catalog fallbacks are fine for browsing;
 * any debit path must call a real provider or throw.
 */
export function providerNotLiveError(provider: string, hint?: string) {
  const base = `${provider} is not configured for live purchases`;
  return new Error(hint ? `${base}. ${hint}` : `${base}.`);
}

export function assertProviderLive(
  live: boolean,
  provider: string,
  hint?: string,
): asserts live {
  if (!live) throw providerNotLiveError(provider, hint);
}
