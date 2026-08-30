import {
  currencyForCountry,
  getCountryInfo,
  resolveCountryCode,
  type SupportedCountryCode,
} from "@/lib/country";
import { fundPresetsForCountry } from "@/lib/paystack/country";

/** Minimum face amount in local currency for flexible international data. */
const INTL_DATA_MIN: Partial<Record<SupportedCountryCode, number>> = {
  GH: 5,
  KE: 50,
};

export function intlDataMinLocal(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === "NG") return 50;
  return INTL_DATA_MIN[code] ?? 50;
}

export function intlDataPresets(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === "KE") return ["50", "100", "200", "500", "1000"];
  if (code === "GH") return ["5", "10", "20", "50", "100"];
  return fundPresetsForCountry(code);
}

export function defaultIntlDataAmount(countryCode?: string | null) {
  const presets = intlDataPresets(countryCode);
  return presets[0] ?? "50";
}

export function intlDataMinError(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  const min = intlDataMinLocal(code);
  const sym = getCountryInfo(code).currencySymbol;
  return `Minimum data amount is ${sym}${min}`;
}

export function intlDataLocalCurrency(countryCode?: string | null) {
  return currencyForCountry(countryCode);
}

export function intlDataVariationLabel(
  countryCode: string | null | undefined,
  amount: number,
) {
  const sym = getCountryInfo(countryCode).currencySymbol;
  return `${sym}${amount} Data`;
}

/** Markets that use flexible amount entry for international data (VTpass). */
export function usesFlexibleIntlData(countryCode?: string | null) {
  return resolveCountryCode(countryCode) === "GH";
}
