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

/** Optional display label for a virtual-number social/service charge row. */
export type VirtualNumberServiceCharge = ServiceCharge & {
  label?: string;
};

/** @deprecated Use VirtualNumberServiceCharge */
export type VirtualNumberCountryCharge = VirtualNumberServiceCharge;

export type FxCurrencyOverride = {
  /** Local units the customer pays per $1 (buy USD). */
  buyRate: number | null;
  /** Local units the customer receives per $1 (sell USD). */
  sellRate: number | null;
  /** Optional percent spread if buy/sell are not set. */
  spreadPercent: number | null;
};

/**
 * Local units per 1 USD. Nigeria is fixed at 1,350 for now.
 * The other markets have a starting rate the admin can change.
 */
export const DEFAULT_USD_CONVERSION_RATES: Record<string, number> = {
  NGN: 1350,
  GHS: 15.5,
  KES: 129,
  ZAR: 18.2,
};

export type CompanyChargesConfig = {
  /** Flat NGN fee shown on withdrawals. */
  withdrawFeeNgn: number;
  services: Record<CompanyChargeSource, ServiceCharge>;
  /**
   * Per-social / product revenue for virtual numbers (5sim product slug).
   * Applies for that app across all countries when the row is enabled.
   */
  virtualNumberByService: Record<string, VirtualNumberServiceCharge>;
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
    virtual_number: { mode: "percent", value: 0, enabled: false },
    social: { mode: "flat", value: 0, enabled: true },
    email: { mode: "flat", value: 0, enabled: true },
    withdraw: { mode: "flat", value: 50, enabled: true },
    betting: { mode: "percent", value: 1, enabled: true },
  },
  virtualNumberByService: {},
  fx: {
    defaultSpreadPercent: 1,
    currencies: {
      NGN: { buyRate: 1350, sellRate: 1350, spreadPercent: null },
      GHS: { buyRate: 15.5, sellRate: 15.5, spreadPercent: null },
      KES: { buyRate: 129, sellRate: 129, spreadPercent: null },
      ZAR: { buyRate: 18.2, sellRate: 18.2, spreadPercent: null },
    },
  },
};

/** Social / apps that virtual numbers support (5sim product slugs). */
export const VIRTUAL_NUMBER_SERVICE_OPTIONS: Array<{
  slug: string;
  label: string;
}> = [
  { slug: "whatsapp", label: "WhatsApp" },
  { slug: "telegram", label: "Telegram" },
  { slug: "google", label: "Google / Gmail" },
  { slug: "instagram", label: "Instagram" },
  { slug: "facebook", label: "Facebook" },
  { slug: "tiktok", label: "TikTok" },
  { slug: "twitter", label: "Twitter / X" },
  { slug: "discord", label: "Discord" },
  { slug: "tinder", label: "Tinder" },
  { slug: "microsoft", label: "Microsoft" },
  { slug: "amazon", label: "Amazon" },
  { slug: "openai", label: "OpenAI / ChatGPT" },
  { slug: "viber", label: "Viber" },
  { slug: "other", label: "Any other" },
];
