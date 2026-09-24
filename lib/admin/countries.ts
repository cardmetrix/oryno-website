export type CountryStatus = "live" | "beta" | "disabled";

export const COUNTRY_STATUS_OPTIONS: Array<{
  value: CountryStatus;
  label: string;
  description: string;
}> = [
  {
    value: "live",
    label: "Live",
    description: "Fully available to users",
  },
  {
    value: "beta",
    label: "Suspended",
    description: "Paused / soft hold (beta)",
  },
  {
    value: "disabled",
    label: "Disabled",
    description: "Hidden and unavailable",
  },
];

export function countryStatusLabel(status: string) {
  if (status === "live") return "Live";
  if (status === "beta") return "Suspended";
  if (status === "disabled") return "Disabled";
  return status;
}

export const DEFAULT_COUNTRY_SERVICES = [
  "wallet",
  "airtime",
  "data",
  "bills",
  "betting",
  "virtual_numbers",
  "social",
  "gift_cards",
  "invoices",
];

/** Common markets admins may add quickly */
export const COUNTRY_PRESETS: Array<{
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
}> = [
  { code: "NG", name: "Nigeria", currency: "NGN", currencySymbol: "₦", flagEmoji: "🇳🇬" },
  { code: "GH", name: "Ghana", currency: "GHS", currencySymbol: "GH₵", flagEmoji: "🇬🇭" },
  { code: "KE", name: "Kenya", currency: "KES", currencySymbol: "KSh", flagEmoji: "🇰🇪" },
  { code: "ZA", name: "South Africa", currency: "ZAR", currencySymbol: "R", flagEmoji: "🇿🇦" },
  { code: "UG", name: "Uganda", currency: "UGX", currencySymbol: "USh", flagEmoji: "🇺🇬" },
  { code: "TZ", name: "Tanzania", currency: "TZS", currencySymbol: "TSh", flagEmoji: "🇹🇿" },
  { code: "RW", name: "Rwanda", currency: "RWF", currencySymbol: "FRw", flagEmoji: "🇷🇼" },
  { code: "ET", name: "Ethiopia", currency: "ETB", currencySymbol: "Br", flagEmoji: "🇪🇹" },
  { code: "CM", name: "Cameroon", currency: "XAF", currencySymbol: "FCFA", flagEmoji: "🇨🇲" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", currencySymbol: "CFA", flagEmoji: "🇨🇮" },
  { code: "SN", name: "Senegal", currency: "XOF", currencySymbol: "CFA", flagEmoji: "🇸🇳" },
  { code: "EG", name: "Egypt", currency: "EGP", currencySymbol: "E£", flagEmoji: "🇪🇬" },
  { code: "MA", name: "Morocco", currency: "MAD", currencySymbol: "MAD", flagEmoji: "🇲🇦" },
  { code: "US", name: "United States", currency: "USD", currencySymbol: "$", flagEmoji: "🇺🇸" },
  { code: "GB", name: "United Kingdom", currency: "GBP", currencySymbol: "£", flagEmoji: "🇬🇧" },
];

export function normalizeCountryCode(code: string) {
  return code.trim().toUpperCase().slice(0, 2);
}

export function normalizeCurrency(code: string) {
  return code.trim().toUpperCase().slice(0, 3);
}
