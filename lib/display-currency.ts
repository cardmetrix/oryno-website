import { currencyForCountry } from "@/lib/country";
import { quoteNgnToLocal, type NgnLocalQuote } from "@/lib/fx/rates";

export type DisplayFx = NgnLocalQuote;

export async function getDisplayFx(
  countryCode?: string | null,
): Promise<DisplayFx> {
  const currency = currencyForCountry(countryCode);
  try {
    return await quoteNgnToLocal(currency);
  } catch {
    return {
      from: "NGN",
      to: currency,
      ngnToLocal: 1,
      localToNgn: 1,
      usdToLocal: currency === "USD" ? 1 : currency === "NGN" ? 1600 : 1,
      provider: "fallback",
      asOf: new Date().toISOString(),
    };
  }
}

/** @deprecated Prefer localServiceLedgerCurrency(countryCode) — Phase 1 uses true local wallets. */
export function nigeriaServiceLedgerCurrency() {
  return "NGN" as const;
}

/** Local services settle on the user's country currency wallet. */
export function localServiceLedgerCurrency(countryCode?: string | null) {
  return currencyForCountry(countryCode);
}
