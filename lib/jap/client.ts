/**
 * JustAnotherPanel (JAP) API client — live social boosting
 * Docs: https://justanotherpanel.com/api
 * Endpoint: POST https://justanotherpanel.com/api/v2
 */

import { japErrorToEnglish } from "./errors";

const DEFAULT_BASE = "https://justanotherpanel.com/api/v2";
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
  return (process.env.JAP_API_KEY || "").trim();
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

/** Retail markup on top of FX buy rate (default 30%). */
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

async function japPost(params: Record<string, string | number>) {
  logJapModeOnce();
  const key = japApiKey();
  if (!key) throw new Error("JAP_API_KEY is not configured");

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
  const res = await fetch(japBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

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

export async function getJapBalance() {
  const json = (await japPost({ action: "balance" })) as {
    balance?: string;
    currency?: string;
  };
  const result = {
    balance: Number(json.balance) || 0,
    currency: json.currency || "USD",
  };
  console.log(LOG_PREFIX, "balance", result);
  return result;
}

/**
 * Verify live API key + balance before charging the user wallet.
 */
export async function assertJapReady(minUsd = 0.01) {
  if (!isJapLive()) {
    throw new Error("JAP_API_KEY is not configured");
  }
  try {
    const { balance, currency } = await getJapBalance();
    console.log(LOG_PREFIX, "preflight balance", { balance, currency, minUsd });
    if (!Number.isFinite(balance)) {
      throw new Error("incorrect api key");
    }
    if (balance < minUsd) {
      throw new Error("not enough funds");
    }
    return { balance, currency };
  } catch (error) {
    throw new Error(
      japErrorToEnglish(
        error instanceof Error ? error.message : "Boost service unavailable",
      ),
    );
  }
}

export async function getJapServices(): Promise<JapService[]> {
  const now = Date.now();
  if (japServicesCache && now - japServicesCache.at < JAP_SERVICES_TTL_MS) {
    console.log(LOG_PREFIX, "services cache hit", {
      count: japServicesCache.data.length,
    });
    return japServicesCache.data;
  }

  const json = await japPost({ action: "services" });
  if (!Array.isArray(json)) throw new Error("Failed to load boost services");

  const data = json
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

  console.log(LOG_PREFIX, "services", { count: data.length });
  japServicesCache = { at: now, data };
  return data;
}

export async function addJapOrder(input: {
  service: number;
  link: string;
  quantity: number;
}) {
  console.log(LOG_PREFIX, "add order", input);
  const json = (await japPost({
    action: "add",
    service: input.service,
    link: input.link,
    quantity: input.quantity,
  })) as { order?: number | string };

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
