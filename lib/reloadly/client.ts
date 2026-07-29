import { DEMO_RELOADLY_PRODUCTS, toBuyProductView } from "./catalog";
import { reloadlyErrorToEnglish } from "./errors";
import type {
  BuyProductView,
  ReloadlyCardCode,
  ReloadlyOrderResponse,
  ReloadlyProduct,
  ReloadlyProductsPage,
} from "./types";

const AUTH_URL = "https://auth.reloadly.com/oauth/token";
const LIVE_BASE = "https://giftcards.reloadly.com";
const SANDBOX_BASE = "https://giftcards-sandbox.reloadly.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

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

export function reloadlyBaseUrl() {
  const override = process.env.RELOADLY_BASE_URL?.trim().replace(/\/$/, "");
  if (override) return override;
  return isReloadlySandbox() ? SANDBOX_BASE : LIVE_BASE;
}

export function hasReloadlyKeys() {
  return Boolean(reloadlyClientId() && reloadlyClientSecret());
}

export function isReloadlyDemoMode() {
  return !hasReloadlyKeys();
}

/** Markup on FX conversion when mapping USD face value → local wallet charge. */
export function reloadlyMarkup() {
  const raw = Number(process.env.RELOADLY_MARKUP || "1.08");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.08;
}

async function getAccessToken() {
  if (!hasReloadlyKeys()) {
    throw new Error("RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET not configured");
  }

  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const audience = isReloadlySandbox()
    ? "https://giftcards-sandbox.reloadly.com"
    : "https://giftcards.reloadly.com";

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
  };
  return cachedToken.token;
}

async function reloadlyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${reloadlyBaseUrl()}${path}`, {
    ...init,
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

export async function fetchReloadlyProducts(options?: {
  countryCode?: string;
  productName?: string;
  size?: number;
  page?: number;
}): Promise<BuyProductView[]> {
  if (isReloadlyDemoMode()) {
    const q = (options?.productName || "").trim().toLowerCase();
    const country = (options?.countryCode || "US").toUpperCase();
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

  try {
    const qs = new URLSearchParams({
      size: String(options?.size ?? 40),
      page: String(options?.page ?? 1),
      includeRange: "true",
      includeFixed: "true",
    });
    if (options?.countryCode) qs.set("countryCode", options.countryCode.toUpperCase());
    if (options?.productName?.trim()) {
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

    return rows
      .filter((p) => !p.status || p.status === "ACTIVE")
      .map(toBuyProductView);
  } catch (error) {
    console.error("[reloadly-products]", error);
    return DEMO_RELOADLY_PRODUCTS.map(toBuyProductView);
  }
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
    console.error("[reloadly-product]", error);
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

  return { order, simulated: false };
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
    const json = await reloadlyFetch<ReloadlyCardCode[] | { cards?: ReloadlyCardCode[] }>(
      `/orders/transactions/${transactionId}/cards`,
    );
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.cards)) return json.cards;
    return [];
  } catch (error) {
    console.error("[reloadly-cards]", error);
    return [];
  }
}
