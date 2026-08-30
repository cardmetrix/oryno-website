import {
  currencyForCountry,
  getCountryInfo,
  resolveCountryCode,
  type SupportedCountryCode,
} from "@/lib/country";
import { fundPresetsForCountry } from "@/lib/paystack/country";
import { ZA_AIRTIME_MIN_ZAR, ZA_AIRTIME_PRESETS } from "./za-airtime";

/** Minimum face amount in local currency for international airtime top-up. */
const INTL_AIRTIME_MIN: Partial<Record<SupportedCountryCode, number>> = {
  GH: 5,
  KE: 50,
  ZA: ZA_AIRTIME_MIN_ZAR,
};

export function intlAirtimeMinLocal(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === "NG") return 50;
  return INTL_AIRTIME_MIN[code] ?? 10;
}

export function intlAirtimePresets(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === "ZA") return [...ZA_AIRTIME_PRESETS];
  return fundPresetsForCountry(code);
}

export function defaultIntlAirtimeAmount(countryCode?: string | null) {
  const presets = intlAirtimePresets(countryCode);
  return presets[0] ?? "50";
}

export function intlAirtimeMinError(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  const min = intlAirtimeMinLocal(code);
  const sym = getCountryInfo(code).currencySymbol;
  return `Minimum airtime amount is ${sym}${min}`;
}

export function intlAirtimeLocalCurrency(countryCode?: string | null) {
  return currencyForCountry(countryCode);
}
