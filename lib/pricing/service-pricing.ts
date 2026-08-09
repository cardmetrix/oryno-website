import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { platformSettings, servicePriceOverrides } from "@/lib/db/schema";
import { roundMoney } from "@/lib/fx/rates";
import {
  DEFAULT_SERVICE_PRICING,
  PRICING_PROVIDERS,
  type OverrideMode,
  type PricingProvider,
  type ServicePriceOverrideDto,
  type ServicePricingConfig,
} from "@/lib/pricing/types";

const SETTINGS_KEY = "service_pricing";
const CACHE_TTL_MS = 20_000;

type OverrideRow = typeof servicePriceOverrides.$inferSelect;

let configCache: { at: number; value: ServicePricingConfig } | null = null;
let overrideCache: {
  at: number;
  byProvider: Map<PricingProvider, Map<string, OverrideRow>>;
} | null = null;

function envMarkup(provider: PricingProvider): number {
  if (provider === "jap") {
    const raw = Number(process.env.JAP_MARKUP || "1.30");
    return Number.isFinite(raw) && raw >= 1 ? raw : 1.3;
  }
  if (provider === "herosms") {
    const raw = Number(process.env.HEROSMS_MARKUP || "1.15");
    return Number.isFinite(raw) && raw >= 1 ? raw : 1.15;
  }
  if (provider === "reloadly") {
    const raw = Number(process.env.RELOADLY_MARKUP || "1.08");
    return Number.isFinite(raw) && raw >= 1 ? raw : 1.08;
  }
  if (provider === "sogo") {
    return 1;
  }
  const raw = Number(process.env.VTPASS_MARKUP || "1");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1;
}

function envPayoutShare() {
  const raw = Number(process.env.SOGO_SELL_PAYOUT_SHARE ?? "1");
  if (!Number.isFinite(raw) || raw <= 0 || raw > 1) return 1;
  return raw;
}

function defaultsFromEnv(): ServicePricingConfig {
  return {
    fxCommission: 0.01,
    providers: {
      jap: { markup: envMarkup("jap"), enabled: true },
      herosms: { markup: envMarkup("herosms"), enabled: true },
      reloadly: { markup: envMarkup("reloadly"), enabled: true },
      sogo: {
        markup: 1,
        payoutShare: envPayoutShare(),
        enabled: true,
      },
      vtpass: { markup: envMarkup("vtpass"), enabled: true },
    },
  };
}

function normalizeConfig(raw: unknown): ServicePricingConfig {
  const base = defaultsFromEnv();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Partial<ServicePricingConfig>;
  const fx =
    typeof input.fxCommission === "number" &&
    Number.isFinite(input.fxCommission) &&
    input.fxCommission >= 0 &&
    input.fxCommission <= 0.2
      ? input.fxCommission
      : base.fxCommission;

  const providers = { ...base.providers };
  for (const key of PRICING_PROVIDERS) {
    const patch = input.providers?.[key];
    if (!patch || typeof patch !== "object") continue;
    const markup =
      typeof patch.markup === "number" &&
      Number.isFinite(patch.markup) &&
      patch.markup >= 1
        ? patch.markup
        : providers[key].markup;
    const payoutShare =
      key === "sogo"
        ? typeof patch.payoutShare === "number" &&
          Number.isFinite(patch.payoutShare) &&
          patch.payoutShare > 0 &&
          patch.payoutShare <= 1
          ? patch.payoutShare
          : (providers.sogo.payoutShare ?? 1)
        : undefined;
    providers[key] = {
      markup,
      enabled: typeof patch.enabled === "boolean" ? patch.enabled : true,
      ...(key === "sogo" ? { payoutShare } : {}),
    };
  }

  return { fxCommission: fx, providers };
}

export function invalidatePricingCache() {
  configCache = null;
  overrideCache = null;
}

export async function getServicePricingConfig(
  force = false,
): Promise<ServicePricingConfig> {
  if (
    !force &&
    configCache &&
    Date.now() - configCache.at < CACHE_TTL_MS
  ) {
    return configCache.value;
  }

  try {
    const row = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, SETTINGS_KEY),
    });
    const value = normalizeConfig(row?.value);
    configCache = { at: Date.now(), value };
    return value;
  } catch {
    const value = defaultsFromEnv();
    configCache = { at: Date.now(), value };
    return value;
  }
}

export async function saveServicePricingConfig(
  next: ServicePricingConfig,
): Promise<ServicePricingConfig> {
  const normalized = normalizeConfig(next);
  await db
    .insert(platformSettings)
    .values({
      key: SETTINGS_KEY,
      value: normalized,
      description:
        "Group markups / payout shares for live service pricing (admin-managed)",
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: normalized, updatedAt: new Date() },
    });
  invalidatePricingCache();
  return normalized;
}

export async function getProviderMarkup(
  provider: PricingProvider,
): Promise<number> {
  const cfg = await getServicePricingConfig();
  return cfg.providers[provider]?.markup ?? envMarkup(provider);
}

export async function getSogoPayoutShare(): Promise<number> {
  const cfg = await getServicePricingConfig();
  return cfg.providers.sogo.payoutShare ?? envPayoutShare();
}

async function loadOverrideMaps(force = false) {
  if (
    !force &&
    overrideCache &&
    Date.now() - overrideCache.at < CACHE_TTL_MS
  ) {
    return overrideCache.byProvider;
  }

  const rows = await db.query.servicePriceOverrides.findMany({
    where: eq(servicePriceOverrides.active, true),
  });
  const byProvider = new Map<PricingProvider, Map<string, OverrideRow>>();
  for (const p of PRICING_PROVIDERS) byProvider.set(p, new Map());
  for (const row of rows) {
    const provider = row.provider as PricingProvider;
    if (!byProvider.has(provider)) continue;
    byProvider.get(provider)!.set(row.serviceKey, row);
  }
  overrideCache = { at: Date.now(), byProvider };
  return byProvider;
}

function applyOverrideMode(
  baseLocal: number,
  mode: OverrideMode | string,
  value: number,
): number {
  if (!Number.isFinite(value)) return roundMoney(baseLocal);
  if (mode === "fixed") return roundMoney(Math.max(0, value));
  if (mode === "markup") {
    // Treat as absolute multiplier replacing group markup path already baked in base —
    // for "markup" on an individual item we reinterpret as multiplier on baseLocal/group.
    return roundMoney(Math.max(0, baseLocal * Math.max(0.01, value)));
  }
  // percent: +10 means +10% on default retail
  return roundMoney(Math.max(0, baseLocal * (1 + value / 100)));
}

type UsdPriceResult = {
  local: number;
  markup: number;
  overrideApplied: boolean;
  listLocal: number;
};

/**
 * Preload markup + overrides once, then price many USD rows synchronously.
 * Avoids N async DB hits when building large catalogs (e.g. JAP).
 */
export async function createUsdPricer(provider: PricingProvider) {
  const markup = await getProviderMarkup(provider);
  const maps = await loadOverrideMaps();
  const providerMap = maps.get(provider);

  return (input: {
    serviceKey?: string | null;
    usd: number;
    buyRate: number;
  }): UsdPriceResult => {
    const listLocal = roundMoney(input.usd * input.buyRate * markup);

    if (!input.serviceKey) {
      return { local: listLocal, markup, overrideApplied: false, listLocal };
    }

    const row = providerMap?.get(input.serviceKey);
    if (!row) {
      return { local: listLocal, markup, overrideApplied: false, listLocal };
    }

    const value = Number(row.value);
    if (row.mode === "markup") {
      const local = roundMoney(
        input.usd * input.buyRate * Math.max(1, value),
      );
      return { local, markup: value, overrideApplied: true, listLocal };
    }

    const local = applyOverrideMode(listLocal, row.mode, value);
    return { local, markup, overrideApplied: true, listLocal };
  };
}

/**
 * Convert USD cost → local retail using admin group markup + optional per-SKU override.
 */
export async function priceUsdToLocal(input: {
  provider: PricingProvider;
  serviceKey?: string | null;
  usd: number;
  buyRate: number;
}): Promise<UsdPriceResult> {
  const price = await createUsdPricer(input.provider);
  return price({
    serviceKey: input.serviceKey,
    usd: input.usd,
    buyRate: input.buyRate,
  });
}

/**
 * Adjust a provider face/local amount (VTpass, Sogo payout) with group + override.
 */
export async function priceLocalAmount(input: {
  provider: PricingProvider;
  serviceKey?: string | null;
  amount: number;
}): Promise<{
  local: number;
  markup: number;
  overrideApplied: boolean;
  listLocal: number;
}> {
  const markup = await getProviderMarkup(input.provider);
  const listLocal =
    input.provider === "sogo"
      ? roundMoney(input.amount * (await getSogoPayoutShare()))
      : roundMoney(input.amount * markup);

  if (!input.serviceKey) {
    return { local: listLocal, markup, overrideApplied: false, listLocal };
  }

  const maps = await loadOverrideMaps();
  const row = maps.get(input.provider)?.get(input.serviceKey);
  if (!row) {
    return { local: listLocal, markup, overrideApplied: false, listLocal };
  }

  const value = Number(row.value);
  if (row.mode === "markup") {
    const local = roundMoney(input.amount * Math.max(0.01, value));
    return { local, markup: value, overrideApplied: true, listLocal };
  }
  const local = applyOverrideMode(listLocal, row.mode, value);
  return { local, markup, overrideApplied: true, listLocal };
}

export function toOverrideDto(row: OverrideRow): ServicePriceOverrideDto {
  return {
    id: row.id,
    provider: row.provider as PricingProvider,
    serviceKey: row.serviceKey,
    label: row.label,
    mode: row.mode as OverrideMode,
    value: Number(row.value),
    active: row.active,
    metadata: row.metadata ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPriceOverrides(provider?: PricingProvider) {
  const rows = provider
    ? await db.query.servicePriceOverrides.findMany({
        where: eq(servicePriceOverrides.provider, provider),
        orderBy: [desc(servicePriceOverrides.updatedAt)],
        limit: 500,
      })
    : await db.query.servicePriceOverrides.findMany({
        orderBy: [desc(servicePriceOverrides.updatedAt)],
        limit: 500,
      });
  return rows.map(toOverrideDto);
}

export async function upsertPriceOverride(input: {
  provider: PricingProvider;
  serviceKey: string;
  label?: string | null;
  mode: OverrideMode;
  value: number;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
}) {
  const serviceKey = input.serviceKey.trim().slice(0, 160);
  if (!serviceKey) throw new Error("serviceKey required");
  if (!PRICING_PROVIDERS.includes(input.provider)) {
    throw new Error("Invalid provider");
  }
  if (!["markup", "fixed", "percent"].includes(input.mode)) {
    throw new Error("Invalid mode");
  }
  if (!Number.isFinite(input.value)) throw new Error("Invalid value");

  const [row] = await db
    .insert(servicePriceOverrides)
    .values({
      provider: input.provider,
      serviceKey,
      label: input.label?.trim().slice(0, 200) || null,
      mode: input.mode,
      value: String(input.value),
      active: input.active !== false,
      metadata: input.metadata ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        servicePriceOverrides.provider,
        servicePriceOverrides.serviceKey,
      ],
      set: {
        label: input.label?.trim().slice(0, 200) || null,
        mode: input.mode,
        value: String(input.value),
        active: input.active !== false,
        metadata: input.metadata ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  invalidatePricingCache();
  return toOverrideDto(row);
}

export async function deletePriceOverride(id: string) {
  const [row] = await db
    .delete(servicePriceOverrides)
    .where(eq(servicePriceOverrides.id, id))
    .returning();
  invalidatePricingCache();
  return row ? toOverrideDto(row) : null;
}

export async function bulkAdjustProvider(input: {
  provider: PricingProvider;
  /** percent adjust applied on top of current group markup, e.g. +5 → markup *= 1.05 */
  percent: number;
}) {
  const cfg = await getServicePricingConfig();
  if (input.provider === "sogo") {
    const current = cfg.providers.sogo.payoutShare ?? 1;
    const nextShare = Math.min(
      1,
      Math.max(0.01, roundMoney(current * (1 + input.percent / 100))),
    );
    cfg.providers.sogo = {
      ...cfg.providers.sogo,
      payoutShare: nextShare,
    };
    return saveServicePricingConfig(cfg);
  }
  const current = cfg.providers[input.provider].markup;
  const nextMarkup = Math.max(1, roundMoney(current * (1 + input.percent / 100)));
  cfg.providers[input.provider] = {
    ...cfg.providers[input.provider],
    markup: nextMarkup,
  };
  return saveServicePricingConfig(cfg);
}

export async function getOverrideFor(
  provider: PricingProvider,
  serviceKey: string,
) {
  const maps = await loadOverrideMaps();
  const row = maps.get(provider)?.get(serviceKey);
  return row ? toOverrideDto(row) : null;
}
