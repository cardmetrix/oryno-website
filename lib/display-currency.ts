import { currencyForCountry } from "@/lib/country";
import { quoteNgnToLocal, type NgnLocalQuote } from "@/lib/fx/rates";

export type DisplayFx = NgnLocalQuote;

export async function getDisplayFx(
  countryCode?: string | null,
): Promise<DisplayFx> {
  const currency = currencyForCountry(countryCode);
  let quote: DisplayFx;
  try {
    quote = await quoteNgnToLocal(currency);
  } catch {
    quote = {
      from: "NGN",
      to: currency,
      ngnToLocal: 1,
      localToNgn: 1,
      usdToLocal: currency === "USD" ? 1 : currency === "NGN" ? 1350 : 1,
      provider: "fallback",
      asOf: new Date().toISOString(),
    };
  }

  try {
    const { adminUsdConversionRate } = await import("@/lib/fx/customer-quote");
    const perUsd = await adminUsdConversionRate(currency);
    const ngnPerUsd =
      currency === "NGN" ? perUsd : await adminUsdConversionRate("NGN");
    if (perUsd > 0 && ngnPerUsd > 0) {
      quote = {
        ...quote,
        usdToLocal: perUsd,
        ngnToLocal: currency === "NGN" ? 1 : perUsd / ngnPerUsd,
        localToNgn: currency === "NGN" ? 1 : ngnPerUsd / perUsd,
        provider: "admin",
      };
    }
  } catch {
    return quote;
  }

  return quote;
}

/** @deprecated Prefer localServiceLedgerCurrency(countryCode) — Phase 1 uses true local wallets. */
export function nigeriaServiceLedgerCurrency() {
  return "NGN" as const;
}

/** Local services settle on the user's country currency wallet. */
export function localServiceLedgerCurrency(countryCode?: string | null) {
  return currencyForCountry(countryCode);
}
