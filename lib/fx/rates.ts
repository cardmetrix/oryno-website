const FX_COMMISSION = 0.01; // 1%

export type FxQuote = {
  base: string;
  quote: string;
  midRate: number;
  /** Rate applied when buying quote with base (includes +1% commission) */
  buyRate: number;
  /** Rate applied when selling quote for base (includes −1% commission) */
  sellRate: number;
  commissionPercent: number;
  provider: string;
  asOf: string;
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

/**
 * Quote for converting between a local currency and USD.
 * Commission: +1% when buying USD, −1% when selling USD.
 */
export async function quoteLocalUsd(localCurrency: string): Promise<FxQuote> {
  const local = localCurrency.toUpperCase();
  const { midRate, provider } = await getUsdMidRate(local);

  return {
    base: "USD",
    quote: local,
    midRate,
    buyRate: midRate * (1 + FX_COMMISSION), // local paid per 1 USD
    sellRate: midRate * (1 - FX_COMMISSION), // local received per 1 USD
    commissionPercent: FX_COMMISSION * 100,
    provider,
    asOf: new Date().toISOString(),
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
  provider: string;
  asOf: string;
};

/** Mid-market quote for showing the Nigeria (NGN) ledger in another currency. */
export async function quoteNgnToLocal(
  localCurrency: string,
): Promise<NgnLocalQuote> {
  const to = localCurrency.toUpperCase();
  if (to === "NGN") {
    return {
      from: "NGN",
      to: "NGN",
      ngnToLocal: 1,
      localToNgn: 1,
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
