const FX_COMMISSION = 0.01; // 1% fallback when company rates are unavailable

export type FxQuote = {
  base: string;
  quote: string;
  midRate: number;
  /** Rate applied when buying USD with local (customer rate, includes ORYNO spread) */
  buyRate: number;
  /** Rate applied when selling USD for local (customer rate, includes ORYNO spread) */
  sellRate: number;
  commissionPercent: number;
  provider: string;
  asOf: string;
  /** True when admin set an explicit customer buy/sell rate. */
  customRate?: boolean;
};

type CacheEntry = { at: number; rates: Record<string, number>; provider: string };
let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 1000 * 60 * 15;

async function fetchUsdRates(): Promise<{
  rates: Record<string, number>;
  provider: string;
}> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { rates: cache.rates, provider: cache.provider };
  }

  // Primary: open.er-api.com (free, no key, broad African coverage)
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
        time_last_update_utc?: string;
      };
      if (json.result === "success" && json.rates) {
        cache = {
          at: Date.now(),
          rates: json.rates,
          provider: "open.er-api.com",
        };
        return { rates: json.rates, provider: "open.er-api.com" };
      }
    }
  } catch (error) {
    console.error("[fx-open-er-api]", error);
  }

  // Fallback: Frankfurter (ECB)
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        rates?: Record<string, number>;
        date?: string;
      };
      if (json.rates) {
        cache = {
          at: Date.now(),
          rates: { ...json.rates, USD: 1 },
          provider: "frankfurter.app",
        };
        return { rates: cache.rates, provider: "frankfurter.app" };
      }
    }
  } catch (error) {
    console.error("[fx-frankfurter]", error);
  }

  // Last-resort static mid rates so demo still works offline
  const fallback = {
    USD: 1,
    NGN: 1600,
    GHS: 15.5,
    KES: 129,
    ZAR: 18.2,
  };
  cache = { at: Date.now(), rates: fallback, provider: "fallback" };
  return { rates: fallback, provider: "fallback" };
}

/** How many units of `currency` equal 1 USD (mid-market). */
export async function getUsdMidRate(currency: string): Promise<{
  midRate: number;
  provider: string;
}> {
  const code = currency.toUpperCase();
  if (code === "USD") return { midRate: 1, provider: "identity" };

  const { rates, provider } = await fetchUsdRates();
  const mid = rates[code];
  if (!mid || !Number.isFinite(mid) || mid <= 0) {
    throw new Error(`No FX rate available for ${code}`);
  }
  return { midRate: mid, provider };
}

export type CustomerFxConfig = {
  defaultSpreadPercent: number;
  currencies: Record<
    string,
    {
      buyRate: number | null;
      sellRate: number | null;
      spreadPercent: number | null;
    }
  >;
};

/**
 * Quote for converting between a local currency and USD.
 * Pass `fxConfig` from company charges on the server. Client callers omit it
 * and get the default 1% spread — this file must stay free of DB imports.
 */
export async function quoteLocalUsd(
  localCurrency: string,
  fxConfig?: CustomerFxConfig | null,
): Promise<FxQuote> {
  const local = localCurrency.toUpperCase();
  const { midRate, provider } = await getUsdMidRate(local);

  let spread = FX_COMMISSION;
  if (fxConfig) {
    const override = fxConfig.currencies[local];
    const spreadPercent =
      override?.spreadPercent != null
        ? override.spreadPercent
        : fxConfig.defaultSpreadPercent;
    spread = Math.max(0, spreadPercent) / 100;
  }

  let buyRate = midRate * (1 + spread);
  let sellRate = midRate * (1 - spread);
  let customRate = false;

  const override = fxConfig?.currencies[local];
  if (override?.buyRate && override.buyRate > 0) {
    buyRate = override.buyRate;
    customRate = true;
  }
  if (override?.sellRate && override.sellRate > 0) {
    sellRate = override.sellRate;
    customRate = true;
  }

  if (sellRate <= 0 || sellRate > buyRate) {
    sellRate = Math.min(buyRate, midRate * (1 - spread));
  }

  return {
    base: "USD",
    quote: local,
    midRate,
    buyRate,
    sellRate,
    commissionPercent: customRate
      ? midRate > 0
        ? roundMoney(((buyRate - midRate) / midRate) * 100, 4)
        : 0
      : spread * 100,
    provider,
    asOf: new Date().toISOString(),
    customRate,
  };
}

export function roundMoney(value: number, decimals = 2) {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Local amount required to buy `usdAmount` (includes commission). */
export function localToBuyUsd(usdAmount: number, buyRate: number) {
  return roundMoney(usdAmount * buyRate);
}

/** Local amount credited when selling `usdAmount` (includes commission). */
export function localFromSellUsd(usdAmount: number, sellRate: number) {
  return roundMoney(usdAmount * sellRate);
}

/** USD received when converting `localAmount` to USD (includes commission). */
export function usdFromLocal(localAmount: number, buyRate: number) {
  return roundMoney(localAmount / buyRate, 2);
}

export { FX_COMMISSION };

export type NgnLocalQuote = {
  from: "NGN";
  to: string;
  /** Multiply an NGN amount by this to get the display currency. */
  ngnToLocal: number;
  /** Multiply a local amount by this to get NGN. */
  localToNgn: number;
  /** Multiply a USD amount by this to get the display currency (mid). */
  usdToLocal?: number;
  provider: string;
  asOf: string;
};

/** Mid-market quote for showing the Nigeria (NGN) ledger in another currency. */
export async function quoteNgnToLocal(
  localCurrency: string,
): Promise<NgnLocalQuote> {
  const to = localCurrency.toUpperCase();
  if (to === "NGN") {
    let usdToNgn = 1;
    try {
      usdToNgn = (await getUsdMidRate("NGN")).midRate;
    } catch {
      usdToNgn = 1600;
    }
    return {
      from: "NGN",
      to: "NGN",
      ngnToLocal: 1,
      localToNgn: 1,
      usdToLocal: usdToNgn,
      provider: "identity",
      asOf: new Date().toISOString(),
    };
  }

  const [ngn, local] = await Promise.all([
    getUsdMidRate("NGN"),
    getUsdMidRate(to),
  ]);
  const ngnToLocal = local.midRate / ngn.midRate;
  if (!Number.isFinite(ngnToLocal) || ngnToLocal <= 0) {
    throw new Error(`No NGN→${to} rate available`);
  }

  return {
    from: "NGN",
    to,
    ngnToLocal,
    localToNgn: 1 / ngnToLocal,
    usdToLocal: local.midRate,
    provider: ngn.provider,
    asOf: new Date().toISOString(),
  };
}

export function convertNgnToLocal(ngnAmount: number, ngnToLocal: number) {
  return roundMoney(Number(ngnAmount) * ngnToLocal);
}

export function convertLocalToNgn(localAmount: number, localToNgn: number) {
  return roundMoney(Number(localAmount) * localToNgn);
}
