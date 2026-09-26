/**
 * Famsup panel API client — live social boosting
 * Docs: https://famsup.com (account → API)
 * Endpoint: POST https://famsup.com/api/v2
 *
 * Actions used: services, add, status, balance.
 * Env: FAMSUP_API_KEY (preferred) or JAP_API_KEY. JAP_DEMO=true forces demo.
 */

import { getUsdMidRate } from "@/lib/fx/rates";
import { japErrorToEnglish } from "./errors";

const DEFAULT_BASE = "https://famsup.com/api/v2";
const LOG_PREFIX = "[jap]";

function truncate(value: string, max = 400) {
  const s = value.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function maskKey(key: string) {
  if (!key) return "(empty)";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function japApiKey() {
  return (process.env.FAMSUP_API_KEY || process.env.JAP_API_KEY || "").trim();
}

export function japBaseUrl() {
  return (
    process.env.JAP_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE
  );
}

export function hasJapKeys() {
  return Boolean(japApiKey());
}

/** Force demo even when a key is set. JAP_DEMO=true|1 */
export function isJapDemoForced() {
  const flag = (process.env.JAP_DEMO || "").toLowerCase();
  return flag === "true" || flag === "1";
}

/** Live when API key is present and JAP_DEMO is not forcing demo. */
export function isJapLive() {
  return hasJapKeys() && !isJapDemoForced();
}

/** Demo mode when keys are missing or JAP_DEMO=true. */
export function isJapDemoMode() {
  return !isJapLive();
}

/** Sync env fallback (logging). Prefer `getProviderMarkup('jap')` for retail. */
export function japMarkup() {
  const raw = Number(process.env.JAP_MARKUP || "1.30");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.3;
}

let loggedMode = false;
function logJapModeOnce() {
  if (loggedMode) return;
  loggedMode = true;
  console.log(LOG_PREFIX, "mode", {
    live: isJapLive(),
    demo: isJapDemoMode(),
    hasKey: hasJapKeys(),
    key: maskKey(japApiKey()),
    base: japBaseUrl(),
    markup: japMarkup(),
  });
}

const JAP_SERVICES_TTL_MS = 10 * 60 * 1000;
/** Keep serving a previous catalog longer when the live panel is slow/down. */
const JAP_SERVICES_STALE_MAX_MS = 6 * 60 * 60 * 1000;
const JAP_TIMEOUT_MS: Record<string, number> = {
  services: 10_000,
  balance: 8_000,
  add: 15_000,
  status: 8_000,
};
const JAP_TIMEOUT_DEFAULT_MS = 10_000;

let japServicesCache: { at: number; data: JapService[] } | null = null;

export type JapService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
};

export type JapOrderStatus = {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  currency?: string;
  error?: string;
};

function japTimeoutMs(action: string) {
  return JAP_TIMEOUT_MS[action] ?? JAP_TIMEOUT_DEFAULT_MS;
}

/**
 * Famsup bills this account in naira. USD is used when FAMSUP_CURRENCY=USD.
 */
export function famsupPanelCurrency() {
  const raw = (
    process.env.FAMSUP_CURRENCY ||
    process.env.JAP_CURRENCY ||
    "NGN"
  )
    .trim()
    .toUpperCase();
  return raw || "NGN";
}

function roundPanelUsd(amount: number) {
  return Math.round(amount * 1_000_000) / 1_000_000;
}

/** Convert a Famsup amount (per 1,000, or a wallet balance) into USD. */
export async function famsupAmountToUsd(amount: number, currency = famsupPanelCurrency()) {
  if (!Number.isFinite(amount)) return 0;
  const code = currency.toUpperCase();
  if (code === "USD" || code === "USDT") return amount;
  const { midRate } = await getUsdMidRate(code);
  if (!Number.isFinite(midRate) || midRate <= 0) {
    throw new Error(`No USD rate for ${code}`);
  }
  return roundPanelUsd(amount / midRate);
}

function mapJapServicesPayload(json: unknown): JapService[] {
  if (!Array.isArray(json)) throw new Error("Failed to load boost services");

  return json
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        service: Number(r.service),
        name: String(r.name ?? ""),
        type: String(r.type ?? "Default"),
        category: String(r.category ?? "Other"),
        rate: Number(r.rate) || 0,
        min: Number(r.min) || 1,
        max: Number(r.max) || 100000,
        refill: Boolean(r.refill),
        cancel: Boolean(r.cancel),
      } satisfies JapService;
    })
    .filter((s) => Number.isFinite(s.service) && s.service > 0 && s.name);
}

async function japPost(params: Record<string, string | number>) {
  logJapModeOnce();
  const key = japApiKey();
  if (!key) throw new Error("FAMSUP_API_KEY is not configured");

  const body = new URLSearchParams();
  body.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    body.set(k, String(v));
  }

  const action = String(params.action || "");
  console.log(LOG_PREFIX, "request", {
    action,
    params: Object.fromEntries(
      Object.entries(params).filter(([k]) => k !== "key"),
    ),
  });

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(japBaseUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(japTimeoutMs(action)),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    throw new Error(
      timedOut
        ? "Boost provider timed out. Try again in a moment."
        : japErrorToEnglish(
            error instanceof Error ? error.message : "Boost service unavailable",
          ),
    );
  }

  const text = await res.text();
  console.log(LOG_PREFIX, "response", {
    action,
    status: res.status,
    ms: Date.now() - started,
    body: truncate(text),
  });

  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(japErrorToEnglish(text || `Boost service error (${res.status})`));
  }

  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    (json as { error?: string }).error
  ) {
    throw new Error(
      japErrorToEnglish(String((json as { error: string }).error)),
    );
  }

  if (!res.ok) {
    throw new Error(japErrorToEnglish(`Boost service error (${res.status})`));
  }

  return json;
}

/** First Famsup call for an order: balance must return before we charge anyone. */
export async function pingFamsup() {
  const started = Date.now();
  console.log("[boost] famsup api request", { action: "balance" });
  const result = await getJapBalance();
  const ms = Date.now() - started;
  console.log("[boost] famsup api ok", { ...result, ms });
  return { ...result, ms };
}

export async function getJapBalance() {
  const json = (await japPost({ action: "balance" })) as {
    balance?: string;
    currency?: string;
  };
  const result = {
    balance: Number(json.balance) || 0,
    currency: (json.currency || famsupPanelCurrency()).toUpperCase(),
  };
  console.log(LOG_PREFIX, "balance", result);
  return result;
}

/**
 * Verify live API key + balance before charging the user wallet.
 */
export async function assertJapReady(minUsd = 0.01) {
  if (!isJapLive()) {
    throw new Error("FAMSUP_API_KEY is not configured");
  }
  try {
    const { balance, currency } = await getJapBalance();
    const panelCurrency = famsupPanelCurrency();
    const balanceUsd = await famsupAmountToUsd(balance, panelCurrency);
    console.log(LOG_PREFIX, "preflight balance", {
      balance,
      reportedCurrency: currency,
      panelCurrency,
      balanceUsd,
      minUsd,
    });
    if (!Number.isFinite(balance)) {
      throw new Error("incorrect api key");
    }
    if (balanceUsd < minUsd) {
      throw new Error("not enough funds");
    }
    return { balance, currency: panelCurrency, balanceUsd };
  } catch (error) {
    throw new Error(
      japErrorToEnglish(
        error instanceof Error ? error.message : "Boost service unavailable",
      ),
    );
  }
}

export async function getJapServiceById(
  serviceId: number,
): Promise<JapService | null> {
  const list = await getJapServices();
  return list.find((s) => s.service === serviceId) ?? null;
}

export async function getJapServices(): Promise<JapService[]> {
  const now = Date.now();
  if (japServicesCache && now - japServicesCache.at < JAP_SERVICES_TTL_MS) {
    console.log(LOG_PREFIX, "services cache hit", {
      count: japServicesCache.data.length,
      ageMs: now - japServicesCache.at,
    });
    return japServicesCache.data;
  }

  try {
    const json = await japPost({ action: "services" });
    const raw = mapJapServicesPayload(json);
    const panelCurrency = famsupPanelCurrency();
    let perUsd = 1;
    if (panelCurrency !== "USD" && panelCurrency !== "USDT") {
      try {
        perUsd = (await getUsdMidRate(panelCurrency)).midRate;
      } catch (error) {
        console.warn("[boost] fx unavailable, using fallback rate", error);
        perUsd = panelCurrency === "NGN" ? 1600 : 0;
        if (!(perUsd > 0)) throw error;
      }
    }
    const data = raw.map((service) => ({
      ...service,
      rate: roundPanelUsd(service.rate / perUsd),
    }));
    console.log(LOG_PREFIX, "services", {
      count: data.length,
      panelCurrency,
      sampleRateUsd: data[0]?.rate ?? null,
    });
    japServicesCache = { at: now, data };
    return data;
  } catch (error) {
    const ageMs = japServicesCache ? now - japServicesCache.at : null;
    if (
      japServicesCache?.data.length &&
      ageMs != null &&
      ageMs < JAP_SERVICES_STALE_MAX_MS
    ) {
      console.warn(LOG_PREFIX, "services fetch failed; using stale cache", {
        count: japServicesCache.data.length,
        ageMs,
        error: error instanceof Error ? error.message : String(error),
      });
      return japServicesCache.data;
    }
    throw error;
  }
}

export async function addJapOrder(input: {
  service: number;
  link: string;
  quantity?: number;
  /** Newline-separated custom comments (Custom Comments services). */
  comments?: string;
}) {
  console.log(LOG_PREFIX, "add order", {
    service: input.service,
    link: input.link,
    quantity: input.quantity,
    commentsCount: input.comments
      ? input.comments.split(/\r?\n/).filter(Boolean).length
      : 0,
  });

  const params: Record<string, string | number> = {
    action: "add",
    service: input.service,
    link: input.link,
  };

  if (input.comments?.trim()) {
    // Custom Comments: JAP expects comments list; quantity is implied by line count.
    params.comments = input.comments.trim();
  } else if (input.quantity != null) {
    params.quantity = input.quantity;
  } else {
    throw new Error("Enter a valid quantity");
  }

  const json = (await japPost(params)) as { order?: number | string };

  if (json.order == null) throw new Error("No order id returned");
  const result = { orderId: String(json.order) };
  console.log(LOG_PREFIX, "add order ok", result);
  return result;
}

export async function getJapOrderStatus(
  orderId: string,
): Promise<JapOrderStatus> {
  console.log(LOG_PREFIX, "order status", { orderId });
  const json = (await japPost({
    action: "status",
    order: orderId,
  })) as JapOrderStatus;
  console.log(LOG_PREFIX, "order status result", {
    orderId,
    status: json.status,
    remains: json.remains,
  });
  return json;
}
