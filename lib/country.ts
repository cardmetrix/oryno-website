export type SupportedCountryCode = "NG" | "GH" | "KE" | "ZA";

export type CountryInfo = {
  code: SupportedCountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
  locale: string;
};

/** Markets ORYNO currently operates in */
export const SUPPORTED_COUNTRIES: Record<SupportedCountryCode, CountryInfo> = {
  NG: {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    currencySymbol: "₦",
    flagEmoji: "🇳🇬",
    locale: "en-NG",
  },
  GH: {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    currencySymbol: "GH₵",
    flagEmoji: "🇬🇭",
    locale: "en-GH",
  },
  KE: {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    currencySymbol: "KSh",
    flagEmoji: "🇰🇪",
    locale: "en-KE",
  },
  ZA: {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    currencySymbol: "R",
    flagEmoji: "🇿🇦",
    locale: "en-ZA",
  },
};

export const DEFAULT_COUNTRY_CODE: SupportedCountryCode = "NG";

/** Map nearby / regional ISO codes onto an ORYNO market */
const REGION_FALLBACKS: Record<string, SupportedCountryCode> = {
  // West Africa → Nigeria
  BJ: "NG",
  TG: "NG",
  BF: "NG",
  NE: "NG",
  ML: "NG",
  SN: "NG",
  CI: "NG",
  LR: "NG",
  SL: "NG",
  GM: "NG",
  GN: "NG",
  GW: "NG",
  CV: "NG",
  MR: "NG",
  // East Africa → Kenya
  UG: "KE",
  TZ: "KE",
  RW: "KE",
  BI: "KE",
  ET: "KE",
  SO: "KE",
  SS: "KE",
  DJ: "KE",
  // Southern Africa → South Africa
  BW: "ZA",
  NA: "ZA",
  ZW: "ZA",
  MZ: "ZA",
  ZM: "ZA",
  MW: "ZA",
  LS: "ZA",
  SZ: "ZA",
  AO: "ZA",
};

export function isSupportedCountryCode(
  code: string | null | undefined,
): code is SupportedCountryCode {
  return Boolean(code && code.toUpperCase() in SUPPORTED_COUNTRIES);
}

/** Normalize any ISO country to a supported ORYNO market */
export function resolveCountryCode(
  raw?: string | null,
): SupportedCountryCode {
  if (!raw) return DEFAULT_COUNTRY_CODE;
  const code = raw.toUpperCase().slice(0, 2);
  if (isSupportedCountryCode(code)) return code;
  return REGION_FALLBACKS[code] ?? DEFAULT_COUNTRY_CODE;
}

export function getCountryInfo(
  code?: string | null,
): CountryInfo {
  return SUPPORTED_COUNTRIES[resolveCountryCode(code)];
}

export function currencyForCountry(code?: string | null) {
  return getCountryInfo(code).currency;
}

export function formatCountryMoney(
  amount: string | number,
  countryCode?: string | null,
) {
  const info = getCountryInfo(countryCode);
  const value = typeof amount === "number" ? amount : Number(amount);
  const formatted = Number.isFinite(value)
    ? Math.abs(value).toLocaleString(info.locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "0.00";
  return `${info.currencySymbol}${formatted}`;
}

export function countryFromPhone(phone?: string | null): SupportedCountryCode | null {
  if (!phone) return null;
  const normalized = phone.replace(/\s+/g, "");
  if (normalized.startsWith("+234") || normalized.startsWith("234")) return "NG";
  if (normalized.startsWith("+233") || normalized.startsWith("233")) return "GH";
  if (normalized.startsWith("+254") || normalized.startsWith("254")) return "KE";
  if (normalized.startsWith("+27") || normalized.startsWith("27")) return "ZA";
  return null;
}
