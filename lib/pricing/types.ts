export const PRICING_PROVIDERS = [
  "jap",
  "herosms",
  "reloadly",
  "sogo",
  "vtpass",
] as const;

export type PricingProvider = (typeof PRICING_PROVIDERS)[number];

export type OverrideMode = "markup" | "fixed" | "percent";

export type ProviderPricing = {
  /** Retail multiplier on USD→local (or face value). ≥ 1. */
  markup: number;
  /** Sogo sell only: share of provider payout (0–1]. */
  payoutShare?: number;
  enabled: boolean;
};

export type ServicePricingConfig = {
  fxCommission: number;
  providers: Record<PricingProvider, ProviderPricing>;
};

export type ServicePriceOverrideDto = {
  id: string;
  provider: PricingProvider;
  serviceKey: string;
  label: string | null;
  mode: OverrideMode;
  value: number;
  active: boolean;
  metadata: Record<string, unknown> | null;
  updatedAt: string;
};

export const DEFAULT_SERVICE_PRICING: ServicePricingConfig = {
  fxCommission: 0.01,
  providers: {
    jap: { markup: 1.3, enabled: true },
    herosms: { markup: 1.15, enabled: true },
    reloadly: { markup: 1.08, enabled: true },
    sogo: { markup: 1, payoutShare: 1, enabled: true },
    vtpass: { markup: 1, enabled: true },
  },
};
