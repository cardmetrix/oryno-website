export const COMPANY_CHARGE_SOURCES = [
  "fx_conversion",
  "gift_card_buy",
  "gift_card_sell",
  "virtual_number",
  "social",
  "email",
  "withdraw",
  "betting",
] as const;

export type CompanyChargeSource = (typeof COMPANY_CHARGE_SOURCES)[number];

export type ChargeMode = "flat" | "percent";

export type ServiceCharge = {
  /** `flat` is always ₦ NGN. `percent` is applied on the quoted retail/payout. */
  mode: ChargeMode;
  value: number;
  enabled: boolean;
};

/** Optional display label for a virtual-number country charge row. */
export type VirtualNumberCountryCharge = ServiceCharge & {
  label?: string;
};

export type FxCurrencyOverride = {
  /** Local units the customer pays per $1 (buy USD). */
  buyRate: number | null;
  /** Local units the customer receives per $1 (sell USD). */
  sellRate: number | null;
  /** Optional percent spread if buy/sell are not set. */
  spreadPercent: number | null;
};

export type CompanyChargesConfig = {
  /** Flat NGN fee shown on withdrawals. */
  withdrawFeeNgn: number;
  services: Record<CompanyChargeSource, ServiceCharge>;
  /**
   * Per-destination-country revenue for virtual numbers (5sim country slug).
   * When a country row is enabled, it overrides `services.virtual_number`.
   */
  virtualNumberByCountry: Record<string, VirtualNumberCountryCharge>;
  fx: {
    /** Default ±% on mid-market when a currency has no buy/sell override. */
    defaultSpreadPercent: number;
    currencies: Record<string, FxCurrencyOverride>;
  };
};

export const DEFAULT_COMPANY_CHARGES: CompanyChargesConfig = {
  withdrawFeeNgn: 50,
  services: {
    fx_conversion: { mode: "percent", value: 0, enabled: false },
    gift_card_buy: { mode: "flat", value: 0, enabled: true },
    gift_card_sell: { mode: "flat", value: 0, enabled: true },
    virtual_number: { mode: "percent", value: 0, enabled: true },
    social: { mode: "flat", value: 0, enabled: true },
    email: { mode: "flat", value: 0, enabled: true },
    withdraw: { mode: "flat", value: 50, enabled: true },
    betting: { mode: "percent", value: 1, enabled: true },
  },
  virtualNumberByCountry: {},
  fx: {
    defaultSpreadPercent: 1,
    currencies: {
      NGN: { buyRate: null, sellRate: null, spreadPercent: null },
      GHS: { buyRate: null, sellRate: null, spreadPercent: null },
      KES: { buyRate: null, sellRate: null, spreadPercent: null },
      ZAR: { buyRate: null, sellRate: null, spreadPercent: null },
    },
  },
};

/** Common 5sim country slugs for admin country-revenue pickers. */
export const VIRTUAL_NUMBER_COUNTRY_OPTIONS: Array<{
  slug: string;
  label: string;
}> = [
  { slug: "nigeria", label: "Nigeria" },
  { slug: "ghana", label: "Ghana" },
  { slug: "kenya", label: "Kenya" },
  { slug: "southafrica", label: "South Africa" },
  { slug: "england", label: "United Kingdom" },
  { slug: "usa", label: "USA" },
  { slug: "canada", label: "Canada" },
  { slug: "india", label: "India" },
  { slug: "indonesia", label: "Indonesia" },
  { slug: "philippines", label: "Philippines" },
  { slug: "brazil", label: "Brazil" },
  { slug: "germany", label: "Germany" },
  { slug: "france", label: "France" },
  { slug: "spain", label: "Spain" },
  { slug: "italy", label: "Italy" },
  { slug: "netherlands", label: "Netherlands" },
  { slug: "poland", label: "Poland" },
  { slug: "ukraine", label: "Ukraine" },
  { slug: "russia", label: "Russia" },
  { slug: "turkey", label: "Turkey" },
  { slug: "egypt", label: "Egypt" },
  { slug: "morocco", label: "Morocco" },
  { slug: "china", label: "China" },
  { slug: "hongkong", label: "Hong Kong" },
  { slug: "australia", label: "Australia" },
  { slug: "mexico", label: "Mexico" },
  { slug: "argentina", label: "Argentina" },
  { slug: "colombia", label: "Colombia" },
  { slug: "vietnam", label: "Vietnam" },
  { slug: "thailand", label: "Thailand" },
  { slug: "malaysia", label: "Malaysia" },
  { slug: "pakistan", label: "Pakistan" },
  { slug: "bangladesh", label: "Bangladesh" },
];
