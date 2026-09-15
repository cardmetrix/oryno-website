/**
 * 5sim.net virtual-number client (SMS activations).
 * Docs: https://5sim.net/docs
 */

const DEFAULT_BASE = "https://5sim.net/v1";
const LOG_PREFIX = "[5sim]";

function truncate(value: string, max = 400) {
  const s = value.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function maskKey(key: string) {
  if (!key) return "(empty)";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function cleanEnv(raw: string) {
  return raw
    .split("#")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function fivesimApiKey() {
  return cleanEnv(process.env.FIVESIM_API_KEY || process.env.FIVE_SIM_API_KEY || "");
}

export function fivesimBaseUrl() {
  return cleanEnv(
    process.env.FIVESIM_BASE_URL || DEFAULT_BASE,
  ).replace(/\/$/, "");
}

export function hasFivesimKeys() {
  return Boolean(fivesimApiKey());
}

export function isFivesimDemoForced() {
  const flag = cleanEnv(process.env.FIVESIM_DEMO || "").toLowerCase();
  return flag === "true" || flag === "1";
}

/** Live when API key is present and FIVESIM_DEMO is not forcing demo. */
export function isFivesimLive() {
  return hasFivesimKeys() && !isFivesimDemoForced();
}

export function isFivesimDemoMode() {
  return !isFivesimLive();
}

export function fivesimMarkup() {
  const raw = Number(process.env.FIVESIM_MARKUP || "1.15");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.15;
}

/** Numbers and email-signup SMS are 5sim only. */
export function numbersProvider(): "fivesim" {
  return "fivesim";
}

let loggedMode = false;
function logModeOnce() {
  if (loggedMode) return;
  loggedMode = true;
  console.log(LOG_PREFIX, "mode", {
    live: isFivesimLive(),
    hasKey: hasFivesimKeys(),
    key: maskKey(fivesimApiKey()),
    base: fivesimBaseUrl(),
    markup: fivesimMarkup(),
  });
}

export function fivesimErrorToEnglish(message: string) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return "Virtual number service error";

  // Keep user-wallet errors readable (do not treat as provider downtime).
  if (
    lower.includes("insufficient usd") ||
    lower.includes("usd card") ||
    lower.includes("usd wallet") ||
    lower.includes("fund your usd")
  ) {
    return raw;
  }

  if (lower.includes("no free phones") || lower.includes("no_numbers")) {
    return "No numbers in stock for that country and service. Try another country.";
  }

  if (
    lower === "no_balance" ||
    lower.includes("not enough user balance") ||
    lower.includes("not enough rating")
  ) {
    return "No numbers available right now. Try another country or try again later.";
  }

  if (
    lower.includes("bad token") ||
    lower.includes("unauthorized") ||
    lower.includes("bad country") ||
    lower.includes("bad operator") ||
    lower.includes("no product") ||
    lower.includes("select country") ||
    lower.includes("select operator")
  ) {
    return "That country or service is not available. Refresh and try again.";
  }
  if (lower.includes("price") && lower.includes("max")) {
    return "Price changed — refresh and try again.";
  }
  if (lower.includes("server offline") || lower.includes("internal")) {
    return "Virtual number provider is temporarily offline.";
  }
  if (lower.includes("order has sms") || lower.includes("order expired")) {
    return "This number can no longer be cancelled.";
  }
  return raw.length > 160 ? "Virtual number request failed" : raw;
}

function errorMessageFromBody(json: unknown, text: string, status: number) {
  if (typeof json === "string" && json.trim()) return json.trim();
  if (json && typeof json === "object") {
    const row = json as { message?: string; error?: string };
    if (typeof row.message === "string" && row.message.trim()) {
      return row.message.trim();
    }
    if (typeof row.error === "string" && row.error.trim()) {
      return row.error.trim();
    }
  }
  const plain = String(text || "").trim();
  if (plain && !plain.startsWith("{") && !plain.startsWith("[")) return plain;
  return `5sim error (${status})`;
}

function isPlainErrorBody(json: unknown) {
  if (typeof json !== "string") return false;
  const t = json.trim().toLowerCase();
  if (!t || t.startsWith("{") || t.startsWith("[")) return false;
  return (
    t.includes("no free phones") ||
    t.includes("not enough") ||
    t.includes("bad ") ||
    t.includes("no product") ||
    t.includes("select ") ||
    t.includes("server offline") ||
    t.includes("order not found") ||
    t.includes("order expired") ||
    t.includes("order has sms")
  );
}

async function fivesimFetch(
  path: string,
  init?: RequestInit & { auth?: boolean },
) {
  logModeOnce();
  const auth = init?.auth !== false;
  const key = fivesimApiKey();
  if (auth && !key) throw new Error("FIVESIM_API_KEY is not configured");

  const method = (init?.method || "GET").toUpperCase();
  const url = `${fivesimBaseUrl()}${path}`;
  console.log(LOG_PREFIX, "request", { method, path });

  const started = Date.now();
  const res = await fetch(url, {
    ...init,
    method,
    headers: {
      Accept: "application/json",
      ...(auth ? { Authorization: `Bearer ${key}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  console.log(LOG_PREFIX, "response", {
    method,
    path,
    status: res.status,
    ms: Date.now() - started,
    body: truncate(text),
  });

  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  // 5sim returns HTTP 200 with a plain error string for "no free phones".
  if (!res.ok || isPlainErrorBody(json)) {
    throw new Error(
      fivesimErrorToEnglish(errorMessageFromBody(json, text, res.status)),
    );
  }

  return json;
}

export type FivesimProfile = {
  balance: number;
  email?: string;
  rating?: number;
};

export async function getFivesimProfile(): Promise<FivesimProfile> {
  const json = (await fivesimFetch("/user/profile")) as Record<string, unknown>;
  return {
    balance: Number(json.balance) || 0,
    email: typeof json.email === "string" ? json.email : undefined,
    rating: typeof json.rating === "number" ? json.rating : undefined,
  };
}

export async function assertFivesimReady(minUsd = 0.01) {
  if (!isFivesimLive()) {
    throw new Error(
      "5sim is not configured. Set FIVESIM_API_KEY and FIVESIM_DEMO=false.",
    );
  }
  const profile = await getFivesimProfile();
  if (profile.balance < minUsd) {
    console.error(LOG_PREFIX, "provider wallet empty", {
      balance: profile.balance,
      minUsd,
    });
    throw new Error("NO_BALANCE");
  }
  return profile.balance;
}

export type FivesimCountry = {
  slug: string;
  name: string;
  iso: string | null;
};

export async function getFivesimCountries(): Promise<FivesimCountry[]> {
  const json = (await fivesimFetch("/guest/countries", {
    auth: false,
  })) as Record<string, Record<string, unknown>>;

  const out: FivesimCountry[] = [];
  for (const [slug, row] of Object.entries(json || {})) {
    if (!row || typeof row !== "object") continue;
    const name = String(row.text_en || slug);
    const isoObj = row.iso as Record<string, number> | undefined;
    const iso = isoObj
      ? Object.keys(isoObj)[0]?.toUpperCase() || null
      : null;
    out.push({ slug, name, iso });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

type OperatorStock = { cost: number; count: number; rate?: number };

/**
 * Guest prices by product:
 * { product: { country: { operator: { cost, count, rate } } } }
 */
export async function getFivesimPricesByProduct(product: string) {
  const qs = new URLSearchParams({ product });
  const json = (await fivesimFetch(`/guest/prices?${qs.toString()}`, {
    auth: false,
  })) as Record<string, Record<string, Record<string, OperatorStock>>>;

  const byCountry = json?.[product] || json || {};
  const offers: {
    countrySlug: string;
    operator: string;
    cost: number;
    count: number;
    rate: number;
  }[] = [];

  for (const [countrySlug, operators] of Object.entries(byCountry)) {
    if (!operators || typeof operators !== "object") continue;
    let best: { operator: string; cost: number; count: number; rate: number } | null =
      null;
    let totalCount = 0;
    for (const [operator, stock] of Object.entries(operators)) {
      const cost = Number(stock?.cost) || 0;
      const count = Number(stock?.count) || 0;
      const rate = Number(stock?.rate) || 0;
      totalCount += count;
      if (count <= 0 || cost <= 0) continue;
      if (!best || cost < best.cost) {
        best = { operator, cost, count, rate };
      }
    }
    if (!best) continue;
    offers.push({
      countrySlug,
      operator: best.operator,
      cost: best.cost,
      count: totalCount || best.count,
      rate: best.rate,
    });
  }

  return offers;
}

export async function buyFivesimActivation(input: {
  country: string;
  product: string;
  operator?: string;
  maxPrice?: number;
}) {
  const country = input.country.trim().toLowerCase();
  const product = input.product.trim().toLowerCase();
  // Docs: maxPrice only applies when operator is "any".
  const operator = "any";
  if (!country || !product) throw new Error("Country and product are required");

  const qs = new URLSearchParams();
  if (input.maxPrice && Number.isFinite(input.maxPrice) && input.maxPrice > 0) {
    qs.set("maxPrice", String(input.maxPrice));
  }
  const q = qs.toString() ? `?${qs}` : "";
  const path = `/user/buy/activation/${encodeURIComponent(country)}/${encodeURIComponent(operator)}/${encodeURIComponent(product)}${q}`;

  const json = (await fivesimFetch(path)) as Record<string, unknown>;
  const id = String(json.id ?? "").trim();
  const phone = String(json.phone ?? "").trim();
  if (!id || !phone) {
    throw new Error("No number returned from 5sim");
  }

  return {
    activationId: id,
    phoneNumber: phone,
    price: Number(json.price) || 0,
    country: String(json.country || country),
    product: String(json.product || product),
    operator: String(json.operator || operator),
    expires: typeof json.expires === "string" ? json.expires : null,
    status: String(json.status || "PENDING"),
  };
}

export async function checkFivesimOrder(activationId: string) {
  const json = (await fivesimFetch(
    `/user/check/${encodeURIComponent(activationId)}`,
  )) as Record<string, unknown>;

  const sms = Array.isArray(json.sms) ? json.sms : [];
  const latest = sms[sms.length - 1] as Record<string, unknown> | undefined;
  const code =
    String(latest?.code || json.code || "").trim() ||
    String(latest?.text || "")
      .match(/\b(\d{4,8})\b/)?.[1] ||
    "";

  const status = String(json.status || "PENDING").toUpperCase();
  return {
    id: String(json.id ?? activationId),
    phone: String(json.phone || ""),
    status,
    code: code || null,
    sms,
    raw: json,
  };
}

export async function cancelFivesimOrder(activationId: string) {
  return fivesimFetch(`/user/cancel/${encodeURIComponent(activationId)}`);
}

export async function finishFivesimOrder(activationId: string) {
  return fivesimFetch(`/user/finish/${encodeURIComponent(activationId)}`);
}
