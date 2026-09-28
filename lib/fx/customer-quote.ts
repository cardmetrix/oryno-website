import { DEFAULT_USD_CONVERSION_RATES } from "@/lib/company/charge-types";
import { getCompanyCharges } from "@/lib/company/charges";
import {
  getUsdMidRate,
  quoteLocalUsd as quoteLocalUsdBase,
  type FxQuote,
} from "@/lib/fx/rates";

/** Server-only USD quote using admin conversion rates from company charges. */
export async function quoteLocalUsd(localCurrency: string): Promise<FxQuote> {
  const charges = await getCompanyCharges();
  return quoteLocalUsdBase(localCurrency, charges.fx);
}

/**
 * Local units per 1 USD from the admin conversion rate.
 * Nigeria defaults to 1,350. Other markets use their saved rate, then the
 * starting rate, then a live mid-market quote only when nothing is configured.
 */
export async function adminUsdConversionRate(localCurrency: string): Promise<number> {
  const code = localCurrency.trim().toUpperCase();
  if (code === "USD" || code === "USDT") return 1;

  const charges = await getCompanyCharges();
  const configured = charges.fx.currencies[code]?.buyRate;
  if (configured && configured > 0) return configured;

  const preset = DEFAULT_USD_CONVERSION_RATES[code];
  if (preset && preset > 0) return preset;

  const { midRate } = await getUsdMidRate(code);
  if (!Number.isFinite(midRate) || midRate <= 0) {
    throw new Error(`No USD rate for ${code}`);
  }
  return midRate;
}
