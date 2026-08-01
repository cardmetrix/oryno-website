/**
 * Reloadly Gift Cards API — buy catalog + orders
 * Docs: https://docs.reloadly.com/gift-cards/Products
 * Auth: https://auth.reloadly.com/oauth/token
 * Live: https://giftcards.reloadly.com
 * Sandbox: https://giftcards-sandbox.reloadly.com
 */

import { DEMO_RELOADLY_PRODUCTS, toBuyProductView } from "./catalog";
import { reloadlyErrorToEnglish } from "./errors";
import type {
  BuyProductView,
  ReloadlyCardCode,
  ReloadlyCountry,
  ReloadlyOrderResponse,
  ReloadlyProduct,
  ReloadlyProductsPage,
} from "./types";

const AUTH_URL = "https://auth.reloadly.com/oauth/token";
const LIVE_BASE = "https://giftcards.reloadly.com";
const SANDBOX_BASE = "https://giftcards-sandbox.reloadly.com";
const LOG_PREFIX = "[reloadly]";

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const COUNTRY_CACHE_TTL_MS = 30 * 60 * 1000;

let cachedToken: { token: string; expiresAt: number; audience: string } | null =
  null;
let productsCache = new Map<string, { at: number; data: BuyProductView[] }>();
let countriesCache: { at: number; data: ReloadlyCountry[] } | null = null;

function truncate(value: string, max = 400) {
  const s = value.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function mask(value: string) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

export function reloadlyClientId() {
  return (process.env.RELOADLY_CLIENT_ID || "").trim();
}

export function reloadlyClientSecret() {
  return (process.env.RELOADLY_CLIENT_SECRET || "").trim();
}

export function isReloadlySandbox() {
  const flag = (process.env.RELOADLY_SANDBOX || "").trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  if (flag === "true" || flag === "1") return true;
  // Default sandbox unless explicitly live
  return true;
}

/** Force demo catalog even when keys exist. */
export function isReloadlyDemoForced() {
  const flag = (process.env.RELOADLY_DEMO || "").toLowerCase();
  return flag === "true" || flag === "1";
}

export function reloadlyBaseUrl() {
  const override = process.env.RELOADLY_BASE_URL?.trim().replace(/\/$/, "");
  if (override) return override;
  return isReloadlySandbox() ? SANDBOX_BASE : LIVE_BASE;
}

export function hasReloadlyKeys() {
  return Boolean(reloadlyClientId() && reloadlyClientSecret());
}

export function isReloadlyLive() {
  return hasReloadlyKeys() && !isReloadlyDemoForced();
}

export function isReloadlyDemoMode() {
  return !isReloadlyLive();
}

/** Markup on FX conversion when mapping USD face value → local wallet charge. */
export function reloadlyMarkup() {
  const raw = Number(process.env.RELOADLY_MARKUP || "1.08");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.08;
}

let loggedMode = false;
function logModeOnce() {
  if (loggedMode) return;
  loggedMode = true;
  console.log(LOG_PREFIX, "mode", {
    live: isReloadlyLive(),
    demo: isReloadlyDemoMode(),
    sandbox: isReloadlySandbox(),
    hasKeys: hasReloadlyKeys(),
    clientId: mask(reloadlyClientId()),
    base: reloadlyBaseUrl(),
    markup: reloadlyMarkup(),
  });
}

async function getAccessToken() {
  logModeOnce();
  if (!hasReloadlyKeys()) {
    throw new Error("RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET not configured");
  }

  const audience = isReloadlySandbox()
    ? "https://giftcards-sandbox.reloadly.com"
    : "https://giftcards.reloadly.com";

  if (
    cachedToken &&
    cachedToken.audience === audience &&
    Date.now() < cachedToken.expiresAt - 60_000
  ) {
    return cachedToken.token;
  }

  console.log(LOG_PREFIX, "auth request", { audience });
  const started = Date.now();
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: reloadlyClientId(),
      client_secret: reloadlyClientSecret(),
      grant_type: "client_credentials",
      audience,
    }),
    cache: "no-store",
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    message?: string;
    error?: string;
  };

  console.log(LOG_PREFIX, "auth response", {
    status: res.status,
    ms: Date.now() - started,
    ok: Boolean(json.access_token),
  });

  if (!res.ok || !json.access_token) {
    throw new Error(
      reloadlyErrorToEnglish(
        json.message || json.error || "Failed to authenticate gift card service",
      ),
    );
  }

  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in || 3600) * 1000,
    audience,
  };
  return cachedToken.token;
}

async function reloadlyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const method = (init?.method || "GET").toUpperCase();
  console.log(LOG_PREFIX, "request", {
    method,
    path,
    body: init?.body ? truncate(String(init.body)) : undefined,
  });

  const started = Date.now();
  const res = await fetch(`${reloadlyBaseUrl()}${path}`, {
    ...init,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/com.reloadly.giftcards-v1+json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  console.log(LOG_PREFIX, "response", {
    method,
    path,
    status: res.status,
    ms: Date.now() - started,
    ok: res.ok,
    body: truncate(text),
  });

  if (!res.ok) {
    const err = json as {
      message?: string;
      errorCode?: string;
      error?: string;
    } | null;
    throw new Error(
      reloadlyErrorToEnglish(
        err?.message || err?.error || text || `Request failed (${res.status})`,
        err?.errorCode,
      ),
    );
  }

  return json as T;
}

function normalizeProducts(rows: ReloadlyProduct[]): BuyProductView[] {
  return rows
    .filter((p) => p?.productId && (!p.status || p.status === "ACTIVE"))
    .map(toBuyProductView)
    .sort((a, b) => a.brandName.localeCompare(b.brandName));
}

async function fetchProductsByCountryPath(
  countryCode: string,
): Promise<ReloadlyProduct[]> {
  const code = countryCode.toUpperCase();
  const json = await reloadlyFetch<ReloadlyProduct[] | ReloadlyProductsPage>(
    `/countries/${encodeURIComponent(code)}/products`,
  );
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.content)) return json.content;
  return [];
}

async function fetchProductsPaginated(options: {
  countryCode?: string;
  productName?: string;
  maxPages?: number;
}): Promise<ReloadlyProduct[]> {
  const size = 100;
  const maxPages = options.maxPages ?? 20;
  const all: ReloadlyProduct[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const qs = new URLSearchParams({
      size: String(size),
      page: String(page),
      includeRange: "true",
      includeFixed: "true",
    });
    if (options.countryCode) {
      qs.set("countryCode", options.countryCode.toUpperCase());
    }
    if (options.productName?.trim()) {
      qs.set("productName", options.productName.trim());
    }

    const json = await reloadlyFetch<ReloadlyProductsPage | ReloadlyProduct[]>(
      `/products?${qs.toString()}`,
    );

    const rows = Array.isArray(json)
      ? json
      : Array.isArray(json?.content)
        ? json.content
        : [];

    all.push(...rows);

    const totalPages =
      !Array.isArray(json) && typeof json?.totalPages === "number"
        ? json.totalPages
        : null;

    console.log(LOG_PREFIX, "products page", {
      page,
      batch: rows.length,
      totalSoFar: all.length,
      totalPages,
    });

    if (!rows.length) break;
    if (totalPages != null && page >= totalPages) break;
    if (rows.length < size) break;
  }

  return all;
}

/**
 * Fetch available gift cards from Reloadly for a country.
 * Prefers GET /countries/{code}/products (full country catalog),
 * falls back to paginated GET /products?countryCode=
 */
export async function fetchReloadlyProducts(options?: {
  countryCode?: string;
  productName?: string;
  size?: number;
  page?: number;
}): Promise<BuyProductView[]> {
  logModeOnce();
  const country = (options?.countryCode || "US").toUpperCase();
  const q = (options?.productName || "").trim().toLowerCase();

  if (isReloadlyDemoMode()) {
    console.log(LOG_PREFIX, "products DEMO", { country, q });
    return DEMO_RELOADLY_PRODUCTS.filter((p) => {
      const iso = (p.country?.isoName || "US").toUpperCase();
      if (country && iso !== country && !p.global) return false;
      if (!q) return true;
      return (
        p.productName.toLowerCase().includes(q) ||
        (p.brand?.brandName || "").toLowerCase().includes(q)
      );
    }).map(toBuyProductView);
  }

  const cacheKey = `${country}|${q}`;
  const cached = productsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < PRODUCT_CACHE_TTL_MS) {
    console.log(LOG_PREFIX, "products cache hit", {
      country,
      count: cached.data.length,
    });
    return cached.data;
  }

  console.log(LOG_PREFIX, "products LIVE fetch", { country, q });

  let rows: ReloadlyProduct[] = [];
  try {
    // Best: full catalog for ISO country
    rows = await fetchProductsByCountryPath(country);
    console.log(LOG_PREFIX, "products by country path", {
      country,
      count: rows.length,
    });
  } catch (error) {
    console.warn(
      LOG_PREFIX,
      "country products path failed — paginated fallback",
      error instanceof Error ? error.message : error,
    );
  }

  if (!rows.length) {
    rows = await fetchProductsPaginated({
      countryCode: country,
      productName: options?.productName,
    });
  }

  // If country path returned everything but user is searching, filter client-side
  let views = normalizeProducts(rows);
  if (q) {
    views = views.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q),
    );
  }

  console.log(LOG_PREFIX, "products LIVE ok", {
    country,
    count: views.length,
  });

  productsCache.set(cacheKey, { at: Date.now(), data: views });
  return views;
}

export async function fetchReloadlyCountries(): Promise<ReloadlyCountry[]> {
  logModeOnce();

  if (isReloadlyDemoMode()) {
    return [
      { isoName: "US", name: "United States", currencyCode: "USD" },
      { isoName: "GB", name: "United Kingdom", currencyCode: "GBP" },
      { isoName: "CA", name: "Canada", currencyCode: "CAD" },
      { isoName: "NG", name: "Nigeria", currencyCode: "NGN" },
      { isoName: "AU", name: "Australia", currencyCode: "AUD" },
    ];
  }

  if (
    countriesCache &&
    Date.now() - countriesCache.at < COUNTRY_CACHE_TTL_MS
  ) {
    return countriesCache.data;
  }

  console.log(LOG_PREFIX, "countries LIVE fetch");
  const json = await reloadlyFetch<ReloadlyCountry[] | { content?: ReloadlyCountry[] }>(
    "/countries",
  );
  const rows = Array.isArray(json)
    ? json
    : Array.isArray(json?.content)
      ? json.content
      : [];

  const data = rows
    .map((c) => ({
      isoName: String(c.isoName || c.isoCode || "")
        .trim()
        .toUpperCase(),
      name: String(c.name || c.isoName || "").trim(),
      currencyCode: String(c.currencyCode || "").trim().toUpperCase() || null,
      flagUrl: c.flagUrl || null,
    }))
    .filter((c) => c.isoName.length === 2 && c.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(LOG_PREFIX, "countries LIVE ok", { count: data.length });
  countriesCache = { at: Date.now(), data };
  return data;
}

export async function fetchReloadlyProduct(
  productId: number,
): Promise<BuyProductView | null> {
  if (isReloadlyDemoMode()) {
    const found = DEMO_RELOADLY_PRODUCTS.find((p) => p.productId === productId);
    return found ? toBuyProductView(found) : null;
  }

  try {
    const p = await reloadlyFetch<ReloadlyProduct>(`/products/${productId}`);
    return toBuyProductView(p);
  } catch (error) {
    console.error(LOG_PREFIX, "product fetch failed", error);
    return null;
  }
}

export async function placeReloadlyOrder(input: {
  productId: number;
  unitPrice: number;
  quantity?: number;
  customIdentifier: string;
  senderName: string;
  recipientEmail: string;
}): Promise<{ order: ReloadlyOrderResponse; simulated: boolean }> {
  if (isReloadlyDemoMode()) {
    const product =
      DEMO_RELOADLY_PRODUCTS.find((p) => p.productId === input.productId) ||
      DEMO_RELOADLY_PRODUCTS[0];
    const order: ReloadlyOrderResponse = {
      transactionId: Date.now(),
      amount: input.unitPrice,
      currencyCode: "USD",
      fee: 0,
      recipientEmail: input.recipientEmail,
      customIdentifier: input.customIdentifier,
      status: "SUCCESSFUL",
      product: {
        productId: product.productId,
        productName: product.productName,
        countryCode: product.country?.isoName || "US",
        quantity: input.quantity || 1,
        unitPrice: input.unitPrice,
        totalPrice: input.unitPrice * (input.quantity || 1),
        currencyCode: product.recipientCurrencyCode,
        brand: product.brand,
      },
    };
    return { order, simulated: true };
  }

  console.log(LOG_PREFIX, "place order LIVE", {
    productId: input.productId,
    unitPrice: input.unitPrice,
    quantity: input.quantity || 1,
  });

  const order = await reloadlyFetch<ReloadlyOrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify({
      productId: input.productId,
      quantity: input.quantity || 1,
      unitPrice: input.unitPrice,
      customIdentifier: input.customIdentifier,
      senderName: input.senderName,
      recipientEmail: input.recipientEmail,
      preOrder: false,
    }),
  });

  console.log(LOG_PREFIX, "place order ok", {
    transactionId: order.transactionId,
    status: order.status,
  });

  return { order, simulated: false };
}

export async function fetchReloadlyBalance(): Promise<{
  balance: number;
  currencyCode: string;
}> {
  if (isReloadlyDemoMode()) {
    return { balance: 9999, currencyCode: "USD" };
  }
  const json = await reloadlyFetch<{
    balance?: number;
    currencyCode?: string;
  }>("/accounts/balance");
  return {
    balance: Number(json?.balance ?? 0),
    currencyCode: String(json?.currencyCode || "USD"),
  };
}

/** Call before wallet debit so users get a clear provider error first. */
export async function assertReloadlyReady(minBalance = 0.01) {
  if (isReloadlyDemoMode()) return { demo: true as const };

  if (!hasReloadlyKeys()) {
    throw new Error(
      "Gift card buy is not configured. Add RELOADLY_CLIENT_ID and RELOADLY_CLIENT_SECRET.",
    );
  }

  const bal = await fetchReloadlyBalance();
  console.log(LOG_PREFIX, "balance", bal);
  if (!Number.isFinite(bal.balance) || bal.balance < minBalance) {
    throw new Error(
      "Gift card provider balance is too low. Top up your Reloadly account, then try again.",
    );
  }
  return { demo: false as const, ...bal };
}

export async function fetchReloadlyCards(
  transactionId: number,
): Promise<ReloadlyCardCode[]> {
  if (isReloadlyDemoMode()) {
    return [
      {
        cardNumber: `DEMO-${transactionId}-CODE`,
        pinCode: null,
      },
    ];
  }

  try {
    const json = await reloadlyFetch<
      ReloadlyCardCode[] | { cards?: ReloadlyCardCode[] }
    >(`/orders/transactions/${transactionId}/cards`);
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.cards)) return json.cards;
    return [];
  } catch (error) {
    console.error(LOG_PREFIX, "cards fetch failed", error);
    return [];
  }
}
