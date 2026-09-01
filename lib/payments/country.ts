import {
  currencyForCountry,
  resolveCountryCode,
  type SupportedCountryCode,
} from "@/lib/country";

export type CountryBank = {
  name: string;
  code: string;
  type?: string;
};

export function accountNumberRules(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === "NG") {
    return {
      min: 10,
      max: 10,
      label: "10-digit account number",
      hint: "Nigerian NUBAN",
    };
  }
  if (code === "GH") {
    return {
      min: 8,
      max: 16,
      label: "Account or MoMo number",
      hint: "Bank account or mobile-money number",
    };
  }
  if (code === "KE") {
    return {
      min: 6,
      max: 16,
      label: "Account or M-Pesa number",
      hint: "Bank account or M-Pesa mobile number",
    };
  }
  return {
    min: 6,
    max: 16,
    label: "Account number",
    hint: "South African bank account",
  };
}

export function fundPresetsForCountry(countryCode?: string | null) {
  switch (resolveCountryCode(countryCode)) {
    case "GH":
      return ["20", "50", "100", "200", "500"];
    case "KE":
      return ["200", "500", "1000", "2000", "5000"];
    case "ZA":
      return ["50", "100", "200", "500", "1000"];
    default:
      return ["1000", "2000", "5000", "10000"];
  }
}

export function demoBanksForCountry(
  countryCode?: string | null,
): CountryBank[] {
  switch (resolveCountryCode(countryCode)) {
    case "GH":
      return [
        { name: "GCB Bank", code: "040100" },
        { name: "Ecobank Ghana", code: "130100" },
        { name: "Stanbic Bank Ghana", code: "190100" },
        { name: "Absa Ghana", code: "030100" },
        { name: "MTN Mobile Money", code: "MTN", type: "mobile_money" },
        { name: "Telecel Cash", code: "VOD", type: "mobile_money" },
        { name: "AirtelTigo Money", code: "ATL", type: "mobile_money" },
      ];
    case "KE":
      return [
        { name: "Equity Bank", code: "68" },
        { name: "KCB", code: "01" },
        { name: "Co-operative Bank", code: "11" },
        { name: "M-Pesa", code: "MPS", type: "mobile_money" },
        { name: "Airtel Money", code: "AIRTEL", type: "mobile_money" },
      ];
    case "ZA":
      return [
        { name: "FNB", code: "250655" },
        { name: "Standard Bank", code: "051001" },
        { name: "Absa", code: "632005" },
        { name: "Nedbank", code: "198765" },
        { name: "Capitec", code: "470010" },
      ];
    default:
      return [
        { name: "Access Bank", code: "044" },
        { name: "GTBank", code: "058" },
        { name: "Kuda", code: "50211" },
        { name: "Zenith Bank", code: "057" },
        { name: "UBA", code: "033" },
        { name: "First Bank", code: "011" },
        { name: "Opay", code: "999992" },
        { name: "Palmpay", code: "999991" },
        { name: "Moniepoint", code: "50515" },
      ];
  }
}

export function addBankInstructions(countryCode?: string | null) {
  const rules = accountNumberRules(countryCode);
  const country = resolveCountryCode(countryCode);
  const market =
    country === "GH"
      ? "Ghana"
      : country === "KE"
        ? "Kenya"
        : country === "ZA"
          ? "South Africa"
          : "Nigeria";
  return [
    `Select a ${market} bank from the list.`,
    `Enter your ${rules.label.toLowerCase()}.`,
    "We verify the account before saving.",
    "Confirm the name matches your bank or wallet records.",
    "Save the account — we use it for withdrawals.",
  ];
}

export function countryFromCurrency(
  currency?: string | null,
): SupportedCountryCode {
  const code = (currency || "NGN").toUpperCase();
  if (code === "GHS") return "GH";
  if (code === "KES") return "KE";
  if (code === "ZAR") return "ZA";
  return "NG";
}

export function payoutCurrency(countryCode?: string | null) {
  return currencyForCountry(countryCode);
}

/** Flutterwave static virtual accounts are available for NG and GH. */
export function flutterwaveSupportsVirtualAccount(
  countryCode?: string | null,
) {
  const code = resolveCountryCode(countryCode);
  return code === "NG" || code === "GH";
}

export function flutterwavePaymentOptions(countryCode?: string | null) {
  switch (resolveCountryCode(countryCode)) {
    case "GH":
      return "card,mobilemoneyghana,banktransfer";
    case "KE":
      return "card,mpesa,mobilemoneyeastafrica";
    case "ZA":
      return "card,account,banktransfer";
    default:
      return "card,banktransfer,ussd,account";
  }
}
