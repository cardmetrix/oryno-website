/**
 * Session-scoped cache for data plan catalogs (browser tab lifetime).
 * Survives leaving/returning to the Data page without refetching Pairgate.
 */

export type CachedDataPlan = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const PREFIX = "oryno:data-plans:v2:";
const TTL_MS = 30 * 60 * 1000;

type Envelope = {
  expiresAt: number;
  plans: CachedDataPlan[];
};

function storageKey(cacheKey: string) {
  return `${PREFIX}${cacheKey}`;
}

export function readDataPlansCache(cacheKey: string): CachedDataPlan[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(cacheKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope;
    if (
      !parsed?.plans?.length ||
      typeof parsed.expiresAt !== "number" ||
      parsed.expiresAt < Date.now()
    ) {
      return null;
    }
    return parsed.plans;
  } catch {
    return null;
  }
}

export function writeDataPlansCache(
  cacheKey: string,
  plans: CachedDataPlan[],
) {
  if (typeof window === "undefined" || !plans.length) return;
  try {
    const payload: Envelope = {
      expiresAt: Date.now() + TTL_MS,
      plans,
    };
    sessionStorage.setItem(storageKey(cacheKey), JSON.stringify(payload));
  } catch {
    // quota / private mode — ignore
  }
}
