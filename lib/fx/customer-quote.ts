import { getCompanyCharges } from "@/lib/company/charges";
import { quoteLocalUsd as quoteLocalUsdBase, type FxQuote } from "@/lib/fx/rates";

/** Server-only USD quote using admin conversion rates from company charges. */
export async function quoteLocalUsd(localCurrency: string): Promise<FxQuote> {
  const charges = await getCompanyCharges();
  return quoteLocalUsdBase(localCurrency, charges.fx);
}
