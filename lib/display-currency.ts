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
      provider: "fallback",
      asOf: new Date().toISOString(),
    };
  }
}

/** Nigeria-priced services always settle on the NGN wallet. */
export function nigeriaServiceLedgerCurrency() {
  return "NGN" as const;
}
