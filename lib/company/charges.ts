import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import {
  COMPANY_CHARGE_SOURCES,
  DEFAULT_COMPANY_CHARGES,
  type CompanyChargeSource,
  type CompanyChargesConfig,
  type FxCurrencyOverride,
  type ServiceCharge,
  type VirtualNumberCountryCharge,
} from "@/lib/company/charge-types";

export {
  COMPANY_CHARGE_SOURCES,
  DEFAULT_COMPANY_CHARGES,
  VIRTUAL_NUMBER_COUNTRY_OPTIONS,
  type CompanyChargeSource,
  type ChargeMode,
  type CompanyChargesConfig,
  type FxCurrencyOverride,
  type ServiceCharge,
  type VirtualNumberCountryCharge,
} from "@/lib/company/charge-types";

const SETTINGS_KEY = "company_charges";
const CACHE_TTL_MS = 15_000;

let cache: { at: number; value: CompanyChargesConfig } | null = null;

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeCharge(
  raw: unknown,
  fallback: ServiceCharge,
): ServiceCharge {
  if (!raw || typeof raw !== "object") return fallback;
  const input = raw as Partial<ServiceCharge>;
  const mode = input.mode === "percent" ? "percent" : "flat";
  const max = mode === "percent" ? 100 : 1_000_000;
  return {
    mode,
    value: clampNumber(input.value, fallback.value, 0, max),
    enabled: typeof input.enabled === "boolean" ? input.enabled : fallback.enabled,
  };
}

function normalizeVirtualNumberCountry(
  raw: unknown,
  fallbackLabel?: string,
): VirtualNumberCountryCharge {
  const base = normalizeCharge(raw, {
    mode: "percent",
    value: 0,
    enabled: true,
  });
  const input =
    raw && typeof raw === "object"
      ? (raw as Partial<VirtualNumberCountryCharge>)
      : {};
  const label =
    typeof input.label === "string" && input.label.trim()
      ? input.label.trim().slice(0, 80)
      : fallbackLabel;
  return label ? { ...base, label } : base;
}

/** Extract 5sim country slug from a pricing service key (`nigeria:whatsapp`). */
export function countrySlugFromServiceKey(serviceKey?: string | null) {
  if (!serviceKey) return null;
  const slug = serviceKey.split(":")[0]?.trim().toLowerCase();
  return slug || null;
}

/**
 * Overall virtual-number charge, or a country-specific override when enabled.
 */
export function resolveVirtualNumberCharge(
  config: CompanyChargesConfig,
  countrySlug?: string | null,
): ServiceCharge {
  const overall = config.services.virtual_number;
  const key = countrySlug?.trim().toLowerCase();
  if (!key) return overall;
  const country = config.virtualNumberByCountry?.[key];
  if (!country) return overall;
  // Enabled country row overrides the overall setting (even when value is 0).
  if (country.enabled) return country;
  return overall;
}

function normalizeFxCurrency(raw: unknown): FxCurrencyOverride {
  if (!raw || typeof raw !== "object") {
    return { buyRate: null, sellRate: null, spreadPercent: null };
  }
  const input = raw as Partial<FxCurrencyOverride>;
  const buy =
    input.buyRate == null || input.buyRate === ("" as unknown)
      ? null
      : clampNumber(input.buyRate, 0, 0, 1_000_000);
  const sell =
    input.sellRate == null || input.sellRate === ("" as unknown)
      ? null
      : clampNumber(input.sellRate, 0, 0, 1_000_000);
  const spread =
    input.spreadPercent == null || input.spreadPercent === ("" as unknown)
      ? null
      : clampNumber(input.spreadPercent, 0, 0, 50);
  return {
    buyRate: buy && buy > 0 ? buy : null,
    sellRate: sell && sell > 0 ? sell : null,
    spreadPercent: spread,
  };
}

export function normalizeCompanyCharges(raw: unknown): CompanyChargesConfig {
  const base = structuredClone(DEFAULT_COMPANY_CHARGES);
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<CompanyChargesConfig>;

  const withdrawFeeNgn = clampNumber(
    input.withdrawFeeNgn,
    base.withdrawFeeNgn,
    0,
    100_000,
  );

  const services = { ...base.services };
  for (const key of COMPANY_CHARGE_SOURCES) {
    services[key] = normalizeCharge(input.services?.[key], services[key]);
  }
  services.withdraw = {
    mode: "flat",
    value: withdrawFeeNgn,
    enabled: services.withdraw.enabled,
  };

  const virtualNumberByCountry: Record<string, VirtualNumberCountryCharge> = {
    ...base.virtualNumberByCountry,
  };
  const incomingCountries = (
    input as Partial<CompanyChargesConfig>
  ).virtualNumberByCountry;
  if (incomingCountries && typeof incomingCountries === "object") {
    for (const [slugRaw, value] of Object.entries(incomingCountries)) {
      const slug = slugRaw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (!slug) continue;
      if (value == null) {
        delete virtualNumberByCountry[slug];
        continue;
      }
      virtualNumberByCountry[slug] = normalizeVirtualNumberCountry(
        value,
        typeof (value as VirtualNumberCountryCharge).label === "string"
          ? (value as VirtualNumberCountryCharge).label
          : slug,
      );
    }
  }

  const currencies: Record<string, FxCurrencyOverride> = {
    ...base.fx.currencies,
  };
  const incoming = input.fx?.currencies;
  if (incoming && typeof incoming === "object") {
    for (const [code, value] of Object.entries(incoming)) {
      const key = code.trim().toUpperCase().slice(0, 3);
      if (!key) continue;
      currencies[key] = normalizeFxCurrency(value);
    }
  }

  return {
    withdrawFeeNgn,
    services,
    virtualNumberByCountry,
    fx: {
      defaultSpreadPercent: clampNumber(
        input.fx?.defaultSpreadPercent,
        base.fx.defaultSpreadPercent,
        0,
        50,
      ),
      currencies,
    },
  };
}

export function invalidateCompanyChargesCache() {
  cache = null;
}

export async function getCompanyCharges(
  force = false,
): Promise<CompanyChargesConfig> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value;
  }

  try {
    const row = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, SETTINGS_KEY),
    });
    const value = normalizeCompanyCharges(row?.value);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    const value = structuredClone(DEFAULT_COMPANY_CHARGES);
    cache = { at: Date.now(), value };
    return value;
  }
}

export async function saveCompanyCharges(
  next: CompanyChargesConfig,
): Promise<CompanyChargesConfig> {
  const normalized = normalizeCompanyCharges(next);
  await db
    .insert(platformSettings)
    .values({
      key: SETTINGS_KEY,
      value: normalized,
      description:
        "Company service charges, withdrawal fee, and customer FX conversion rates",
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: normalized, updatedAt: new Date() },
    });
  invalidateCompanyChargesCache();
  return normalized;
}

export async function getServiceCharge(source: CompanyChargeSource) {
  const cfg = await getCompanyCharges();
  return cfg.services[source];
}

export async function getWithdrawFeeNgn() {
  const cfg = await getCompanyCharges();
  if (!cfg.services.withdraw.enabled) return 0;
  return Math.max(0, cfg.withdrawFeeNgn);
}

export async function getWithdrawFeeDisplay(
  countryCode?: string | null,
): Promise<{
  ngn: number;
  local: number;
  currency: string;
  formatted: string;
  formattedNgn: string;
}> {
  const { getDisplayFx } = await import("@/lib/display-currency");
  const { convertNgnToLocal } = await import("@/lib/fx/rates");
  const { formatCountryMoney, currencyForCountry, resolveCountryCode } =
    await import("@/lib/country");
  const ngn = await getWithdrawFeeNgn();
  const code = resolveCountryCode(countryCode);
  const currency = currencyForCountry(code);
  const fx = await getDisplayFx(code);
  const local =
    currency === "NGN" ? ngn : convertNgnToLocal(ngn, fx.ngnToLocal);
  return {
    ngn,
    local,
    currency,
    formatted: formatCountryMoney(local, code),
    formattedNgn: `₦${ngn.toFixed(2)}`,
  };
}

export function chargeAmountOn(base: number, charge: ServiceCharge) {
  if (!charge.enabled || !Number.isFinite(base) || charge.value <= 0) return 0;
  if (charge.mode === "percent") {
    return Math.round(base * (charge.value / 100) * 100) / 100;
  }
  return Math.round(charge.value * 100) / 100;
}

/**
 * Convert a flat ₦ charge into the quote currency using USD cross rates.
 * `localBuyRate` = local units per $1. `ngnBuyRate` = ₦ per $1.
 */
export function flatNgnToQuoteCurrency(
  ngnAmount: number,
  localBuyRate: number,
  ngnBuyRate: number,
) {
  if (!Number.isFinite(ngnAmount) || ngnAmount <= 0) return 0;
  if (!Number.isFinite(localBuyRate) || localBuyRate <= 0) return ngnAmount;
  if (!Number.isFinite(ngnBuyRate) || ngnBuyRate <= 0) return ngnAmount;
  return Math.round(((ngnAmount * localBuyRate) / ngnBuyRate) * 100) / 100;
}

export function applySilentCharge(input: {
  base: number;
  charge: ServiceCharge;
  /** When charge is flat NGN and quote is not NGN. */
  localBuyRate?: number;
  ngnBuyRate?: number;
  /** sell: subtract from a payout; buy: add to retail. */
  direction?: "add" | "subtract";
}): { total: number; chargeAmount: number } {
  const base = Number.isFinite(input.base) ? input.base : 0;
  if (!input.charge.enabled || input.charge.value <= 0) {
    return { total: Math.round(base * 100) / 100, chargeAmount: 0 };
  }

  let extra = 0;
  if (input.charge.mode === "percent") {
    extra = chargeAmountOn(base, input.charge);
  } else {
    extra = flatNgnToQuoteCurrency(
      input.charge.value,
      input.localBuyRate ?? 1,
      input.ngnBuyRate ?? 1,
    );
  }

  extra = Math.max(0, Math.round(extra * 100) / 100);
  const direction = input.direction ?? "add";
  const total =
    direction === "subtract"
      ? Math.max(0, Math.round((base - extra) * 100) / 100)
      : Math.round((base + extra) * 100) / 100;
  return { total, chargeAmount: extra };
}
