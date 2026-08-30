import {
  FALLBACK_DEMO_RATES_NGN,
  FALLBACK_GIFT_CARD_CATALOG,
  normalizeCatalogBrand,
  toBrandView,
} from "./catalog";
import { sogoErrorToEnglish } from "./errors";
import type {
  GiftCardBrandView,
  SogoApiError,
  SogoCardType,
  SogoCatalogBrand,
  SogoPhysicalSubType,
  SogoRateEntry,
  SogoSellResponse,
} from "./types";

const LIVE_BASE = "https://api.sogo.africa/v1";
const SANDBOX_BASE = "https://sandbox.sogo.africa/v1";

export function sogoSecretKey() {
  const key = (process.env.SOGO_SECRET_KEY || "").trim();
  // Gift-card sell endpoints require a secret key (sogo_sk_*), not public (sogo_pk_*).
  if (!key || key.startsWith("sogo_pk_")) return "";
  return key;
}

export function sogoPublicKey() {
  const fromEnv = (process.env.SOGO_PUBLIC_KEY || "").trim();
  if (fromEnv) return fromEnv;
  const secretSlot = (process.env.SOGO_SECRET_KEY || "").trim();
  if (secretSlot.startsWith("sogo_pk_")) return secretSlot;
  return "";
}

export function sogoWebhookSecret() {
  return (process.env.SOGO_WEBHOOK_SECRET || "").trim();
}

export function isSogoSandbox() {
  const key = sogoSecretKey();
  if (key.startsWith("sogo_sk_live_")) return false;
  // Dashboard keys use sogo_sk_sandbox_; docs also mention sogo_sk_test_.
  if (
    key.startsWith("sogo_sk_test_") ||
    key.startsWith("sogo_sk_sandbox_")
  ) {
    return true;
  }
  const flag = (process.env.SOGO_SANDBOX || "").trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  return false;
}

export function sogoBaseUrl() {
  const override = process.env.SOGO_BASE_URL?.trim().replace(/\/$/, "");
  if (override) return override;
  return isSogoSandbox() ? SANDBOX_BASE : LIVE_BASE;
}

export function hasSogoKeys() {
  return Boolean(sogoSecretKey());
}

export function isSogoDemoMode() {
  if (!hasSogoKeys()) return true;
  const flag = (process.env.SOGO_DEMO || "").trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  return false;
}

/**
 * Share of provider payout credited to the user.
 * Default 1 = pass through the exact provider rate (no ORYNO haircut).
 * Set e.g. 0.97 only if you intentionally keep a margin.
 */
/** Sync env fallback. Prefer `getSogoPayoutShare()` for retail. */
export function sogoSellPayoutShare() {
  const raw = Number(process.env.SOGO_SELL_PAYOUT_SHARE ?? "1");
  if (!Number.isFinite(raw) || raw <= 0 || raw > 1) return 1;
  return raw;
}

type SogoRequestInit = Omit<RequestInit, "headers"> & {
  idempotencyKey?: string;
  headers?: HeadersInit;
};

function mergeHeaders(initHeaders?: HeadersInit) {
  const headers: Record<string, string> = {};
  if (!initHeaders) return headers;
  new Headers(initHeaders).forEach((value, name) => {
    headers[name] = value;
  });
  return headers;
}

export async function sogoRequest<T>(
  path: string,
  init?: SogoRequestInit,
): Promise<T> {
  const key = sogoSecretKey();
  if (!key) throw new Error("SOGO_SECRET_KEY is not configured");

  const { idempotencyKey, headers: initHeaders, ...rest } = init || {};
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "X-API-Key": key,
    Accept: "application/json",
    ...mergeHeaders(initHeaders),
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const body = rest.body;
  const hasContentType = Object.keys(headers).some(
    (name) => name.toLowerCase() === "content-type",
  );
  if (body && !(body instanceof FormData) && !hasContentType) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${sogoBaseUrl()}${path}`, {
    ...rest,
    headers,
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
    const err = json as SogoApiError | null;
    const fieldErrors = err?.error?.errors || err?.errors;
    const message =
      err?.error?.message ||
      err?.message ||
      text ||
      `Sogo request failed (${res.status})`;
    const wrapped = new Error(
      sogoErrorToEnglish(message, err?.error?.code, fieldErrors),
    ) as Error & {
      code?: string;
      status?: number;
      errors?: Record<string, string[] | string>;
    };
    wrapped.code = err?.error?.code;
    wrapped.status = res.status;
    wrapped.errors = fieldErrors;
    throw wrapped;
  }

  return json as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Docs: 503 service_unavailable is transient — retry; no charge was made. */
async function sogoRequestWithRetry<T>(
  path: string,
  init?: SogoRequestInit,
  attempts = 3,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await sogoRequest<T>(path, init);
    } catch (error) {
      last = error;
      const err = error as { status?: number; code?: string; message?: string };
      const msg = (err.message || "").toLowerCase();
      // Product flag from Sogo, not a blip — don't wait out retries.
      if (
        /not currently available via the partner api|could not accept this gift card/.test(
          msg,
        )
      ) {
        throw error;
      }
      const retryable =
        err.status === 503 ||
        err.status === 429 ||
        err.code === "service_unavailable" ||
        err.code === "rate_limit_exceeded" ||
        err.code === "idempotency_request_in_progress";
      if (!retryable || i === attempts - 1) throw error;
      await sleep(err.status === 429 ? 1500 * (i + 1) : 700 * (i + 1));
    }
  }
  throw last;
}

export function unwrapSogoData<T>(json: unknown): T {
  if (!json || typeof json !== "object") {
    throw new Error("Empty response from provider");
  }
  const obj = json as { data?: T };
  if (obj.data != null) return obj.data;
  return json as T;
}

export async function fetchSogoNgnBalance(): Promise<number | null> {
  if (isSogoDemoMode()) return Number.POSITIVE_INFINITY;
  try {
    const json = await sogoRequest<{
      data?: Array<{ currency?: string; balance?: number | string }>;
    }>("/wallet");
    const rows = Array.isArray(json?.data) ? json.data : [];
    const ngn = rows.find((row) => (row.currency || "").toUpperCase() === "NGN");
    const n = Number(ngn?.balance);
    return Number.isFinite(n) ? n : null;
  } catch (error) {
    console.error("[sogo-wallet]", error);
    return null;
  }
}

export function isSogoUnavailableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; status?: number; message?: string };
  if (err.code === "service_unavailable" || err.status === 503) return true;
  return /temporarily unavailable|not currently available|could not accept this gift card/i.test(
    err.message || "",
  );
}

/** True after a successful live catalog or rates response in this process. */
let giftCardsPartnerLive = false;

export function isSogoGiftCardsPartnerLive() {
  return giftCardsPartnerLive;
}

export async function fetchSogoSellCatalog(): Promise<GiftCardBrandView[]> {
  if (isSogoDemoMode()) {
    return FALLBACK_GIFT_CARD_CATALOG.map(toBrandView);
  }

  try {
    const json = await sogoRequest<{ data: SogoCatalogBrand[] }>(
      "/gift-cards/sell/catalog",
    );
    const rows = Array.isArray(json?.data)
      ? json.data
      : Array.isArray((json as { brands?: SogoCatalogBrand[] })?.brands)
        ? ((json as { brands: SogoCatalogBrand[] }).brands)
        : [];
    if (!rows.length) {
      giftCardsPartnerLive = false;
      return FALLBACK_GIFT_CARD_CATALOG.map(toBrandView);
    }
    giftCardsPartnerLive = true;
    return rows
      .map((row) => toBrandView(normalizeCatalogBrand(row)))
      .filter((b) => b.active && b.slug);
  } catch (error) {
    giftCardsPartnerLive = false;
    console.error("[sogo-catalog]", error);
    return FALLBACK_GIFT_CARD_CATALOG.map(toBrandView);
  }
}

export async function fetchSogoSellRates(slug?: string): Promise<SogoRateEntry[]> {
  const demoRates = () => {
    const brands = slug
      ? FALLBACK_GIFT_CARD_CATALOG.filter((b) => b.slug === slug)
      : FALLBACK_GIFT_CARD_CATALOG;

    return brands.map((b) => {
      const base = FALLBACK_DEMO_RATES_NGN[b.slug] ?? 1400;
      const rates: SogoRateEntry["rates"] = {};
      for (const currency of b.currencies) {
        rates[currency] = {
          ecode: { NGN: base },
          physical: {
            NGN: {
              cash_receipt: Math.round(base * 1.01),
              debit_receipt: Math.round(base * 0.995),
              no_receipt: Math.round(base * 0.98),
            },
          },
        };
      }
      return { slug: b.slug, name: b.name, rates };
    });
  };

  if (isSogoDemoMode()) return demoRates();

  try {
    const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
    const json = await sogoRequest<{ data: SogoRateEntry[] }>(
      `/gift-cards/sell/rates${qs}`,
    );
    const rows = Array.isArray(json?.data) ? json.data : [];
    if (!rows.length) {
      giftCardsPartnerLive = false;
      return demoRates();
    }
    giftCardsPartnerLive = true;
    return rows;
  } catch (error) {
    giftCardsPartnerLive = false;
    console.error("[sogo-rates]", error);
    return demoRates();
  }
}

export function extractNgnRate(input: {
  entry?: SogoRateEntry | null;
  currency: string;
  cardType: SogoCardType;
  subType?: SogoPhysicalSubType | null;
}): number | null {
  const { entry, currency, cardType, subType } = input;
  if (!entry?.rates) return null;

  const rateMap = entry.rates as Record<string, unknown>;
  const currencyKey =
    Object.keys(rateMap).find(
      (k) => k.toUpperCase() === currency.toUpperCase(),
    ) || currency.toUpperCase();
  const byCurrency = rateMap[currencyKey] as
    | Record<string, unknown>
    | undefined;
  if (!byCurrency || typeof byCurrency !== "object") return null;

  const typeKey =
    Object.keys(byCurrency).find(
      (k) =>
        k.toLowerCase() === cardType.toLowerCase() ||
        (cardType === "ecode" &&
          ["e_code", "e-code", "code"].includes(k.toLowerCase())),
    ) || cardType;
  const bucket = byCurrency[typeKey];
  if (bucket == null) return null;

  const asNumber = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/,/g, ""));
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  const direct = asNumber(bucket);
  if (direct != null) return direct;

  if (typeof bucket !== "object") return null;
  const record = bucket as Record<string, unknown>;

  if (cardType === "ecode") {
    const ngn = asNumber(record.NGN ?? record.ngn);
    if (ngn != null) return ngn;
    for (const v of Object.values(record)) {
      const n = asNumber(v);
      if (n != null) return n;
    }
    return null;
  }

  const ngnNode = record.NGN ?? record.ngn;
  const ngnDirect = asNumber(ngnNode);
  if (ngnDirect != null) return ngnDirect;

  if (ngnNode && typeof ngnNode === "object") {
    const nested = ngnNode as Record<string, unknown>;
    const sub = subType || "cash_receipt";
    const preferred = asNumber(nested[sub]);
    if (preferred != null) return preferred;
    for (const v of Object.values(nested)) {
      const n = asNumber(v);
      if (n != null) return n;
    }
  }

  if (subType) {
    const n = asNumber(record[subType]);
    if (n != null) return n;
  }

  return null;
}

export async function submitSogoGiftCardSell(input: {
  slug: string;
  cardCountry: string;
  cardType: SogoCardType;
  subType?: SogoPhysicalSubType | null;
  cardCurrency: string;
  cardAmount: number;
  additionalInfo?: string | null;
  images?: { filename: string; mime: string; base64: string }[];
  payoutCurrency?: string;
  specificCountry?: string | null;
  idempotencyKey: string;
}): Promise<{ data: SogoSellResponse; simulated: boolean }> {
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live gift-card sales. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }

  const cardAmount = Number.parseFloat(String(input.cardAmount));
  const payoutCurrency = (input.payoutCurrency || "NGN").toUpperCase();
  const specificCountry = input.specificCountry?.trim() || undefined;

  function readSellData(json: unknown): SogoSellResponse {
    const data = unwrapSogoData<SogoSellResponse>(json);
    if (!data?.reference && !data?.id) {
      throw new Error("Empty response from provider");
    }
    return data;
  }

  if (input.cardType === "physical" && input.images?.length) {
    const form = new FormData();
    form.set("slug", input.slug);
    form.set("card_country", input.cardCountry.toUpperCase());
    form.set("card_type", "physical");
    if (input.subType) form.set("sub_type", input.subType);
    form.set("card_currency", input.cardCurrency.toUpperCase());
    form.set("card_amount", String(cardAmount));
    if (payoutCurrency !== "NGN") form.set("payout_currency", payoutCurrency);
    if (specificCountry) form.set("specific_country", specificCountry);
    if (input.additionalInfo) form.set("additional_info", input.additionalInfo);

    for (const img of input.images.slice(0, 5)) {
      const bytes = Buffer.from(img.base64, "base64");
      const blob = new Blob([bytes], { type: img.mime || "image/jpeg" });
      const filename = img.filename || "card.jpg";
      // Docs field is `images`. Laravel also accepts `images[]`.
      form.append("images", blob, filename);
    }

    const json = await sogoRequestWithRetry<unknown>("/gift-cards/sell", {
      method: "POST",
      body: form,
      idempotencyKey: input.idempotencyKey,
    });
    return { data: readSellData(json), simulated: false };
  }

  // Exact e-code contract from https://developer.sogo.africa/products/gift-cards
  const payload: Record<string, unknown> = {
    slug: input.slug,
    card_country: input.cardCountry.toUpperCase(),
    card_type: input.cardType,
    card_currency: input.cardCurrency.toUpperCase(),
    card_amount: cardAmount,
  };
  if (input.cardType === "physical" && input.subType) {
    payload.sub_type = input.subType;
  }
  if (input.additionalInfo) payload.additional_info = input.additionalInfo;
  if (payoutCurrency !== "NGN") payload.payout_currency = payoutCurrency;
  if (specificCountry) payload.specific_country = specificCountry;

  const json = await sogoRequestWithRetry<unknown>("/gift-cards/sell", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify(payload),
  });

  return { data: readSellData(json), simulated: false };
}
