import {
  FALLBACK_DEMO_RATES_NGN,
  FALLBACK_GIFT_CARD_CATALOG,
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
  return (process.env.SOGO_SECRET_KEY || "").trim();
}

export function sogoWebhookSecret() {
  return (process.env.SOGO_WEBHOOK_SECRET || "").trim();
}

export function isSogoSandbox() {
  const key = sogoSecretKey();
  if (key.startsWith("sogo_sk_test_")) return true;
  if (key.startsWith("sogo_sk_live_")) return false;
  const flag = (process.env.SOGO_SANDBOX || "").trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
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
  return !hasSogoKeys();
}

/**
 * Share of Sogo payout credited to the user (rest is ORYNO margin).
 * Default 0.97 = user gets 97%.
 */
export function sogoSellPayoutShare() {
  const raw = Number(process.env.SOGO_SELL_PAYOUT_SHARE || "0.97");
  if (!Number.isFinite(raw) || raw <= 0 || raw > 1) return 0.97;
  return raw;
}

async function sogoFetch<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string },
): Promise<T> {
  const key = sogoSecretKey();
  if (!key) throw new Error("SOGO_SECRET_KEY is not configured");

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (init?.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }

  const body = init?.body;
  if (body && !(body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${sogoBaseUrl()}${path}`, {
    ...init,
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
    const message =
      err?.error?.message ||
      err?.message ||
      text ||
      `Sogo request failed (${res.status})`;
    throw new Error(sogoErrorToEnglish(message, err?.error?.code));
  }

  return json as T;
}

export async function fetchSogoSellCatalog(): Promise<GiftCardBrandView[]> {
  if (isSogoDemoMode()) {
    return FALLBACK_GIFT_CARD_CATALOG.map(toBrandView);
  }

  try {
    const json = await sogoFetch<{ data: SogoCatalogBrand[] }>(
      "/gift-cards/sell/catalog",
    );
    const rows = Array.isArray(json?.data) ? json.data : [];
    if (!rows.length) return FALLBACK_GIFT_CARD_CATALOG.map(toBrandView);
    return rows.map(toBrandView).filter((b) => b.active);
  } catch (error) {
    console.error("[sogo-catalog]", error);
    return FALLBACK_GIFT_CARD_CATALOG.map(toBrandView);
  }
}

export async function fetchSogoSellRates(slug?: string): Promise<SogoRateEntry[]> {
  if (isSogoDemoMode()) {
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
  }

  const qs = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  const json = await sogoFetch<{ data: SogoRateEntry[] }>(
    `/gift-cards/sell/rates${qs}`,
  );
  return Array.isArray(json?.data) ? json.data : [];
}

export function extractNgnRate(input: {
  entry?: SogoRateEntry | null;
  currency: string;
  cardType: SogoCardType;
  subType?: SogoPhysicalSubType | null;
}): number | null {
  const { entry, currency, cardType, subType } = input;
  if (!entry?.rates) return null;
  const byCurrency = entry.rates[currency] || entry.rates[currency.toUpperCase()];
  if (!byCurrency) return null;

  const bucket = byCurrency[cardType];
  if (bucket == null) return null;

  if (typeof bucket === "number") return bucket;

  // ecode: { NGN: 1634 } or physical nested
  if (cardType === "ecode") {
    if (typeof (bucket as { NGN?: number }).NGN === "number") {
      return (bucket as { NGN: number }).NGN;
    }
    const vals = Object.values(bucket as Record<string, unknown>);
    const n = vals.find((v) => typeof v === "number");
    return typeof n === "number" ? n : null;
  }

  // physical: { NGN: { cash_receipt: n, ... } } or flat
  const asRecord = bucket as Record<string, unknown>;
  const ngn = asRecord.NGN;
  if (typeof ngn === "number") return ngn;
  if (ngn && typeof ngn === "object") {
    const sub = subType || "cash_receipt";
    const v = (ngn as Record<string, number>)[sub];
    if (typeof v === "number") return v;
    const first = Object.values(ngn as Record<string, number>).find(
      (x) => typeof x === "number",
    );
    return typeof first === "number" ? first : null;
  }

  if (subType && typeof asRecord[subType] === "number") {
    return asRecord[subType] as number;
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
    const code = (input.additionalInfo || input.images?.[0]?.filename || "1234")
      .slice(-4)
      .toLowerCase();
    let status = "completed";
    if (code === "0000") status = "cancelled";
    else if (code === "9999") status = "pending";

    const rate =
      FALLBACK_DEMO_RATES_NGN[input.slug] ??
      FALLBACK_DEMO_RATES_NGN.amazon ??
      1400;
    const raw = Math.round(input.cardAmount * rate * 100) / 100;
    const brand =
      FALLBACK_GIFT_CARD_CATALOG.find((b) => b.slug === input.slug)?.name ||
      input.slug;

    const data: SogoSellResponse = {
      id: `demo-${input.idempotencyKey.slice(0, 8)}`,
      reference: `DEMOGC${Date.now().toString(36).toUpperCase()}`.slice(0, 20),
      card_name: `${brand} Gift Card`,
      card_country: input.cardCountry,
      card_type: input.cardType,
      sub_type: input.subType ?? null,
      card_amount: input.cardAmount,
      card_currency: input.cardCurrency,
      payout_amount: {
        raw,
        formatted: `NGN ${raw.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
        currency: "NGN",
      },
      status,
      created_at: new Date().toISOString(),
    };
    return { data, simulated: true };
  }

  if (input.cardType === "physical" && input.images?.length) {
    const form = new FormData();
    form.set("slug", input.slug);
    form.set("card_country", input.cardCountry);
    form.set("card_type", input.cardType);
    if (input.subType) form.set("sub_type", input.subType);
    form.set("card_currency", input.cardCurrency);
    form.set("card_amount", String(input.cardAmount));
    form.set("payout_currency", input.payoutCurrency || "NGN");
    if (input.specificCountry) form.set("specific_country", input.specificCountry);
    if (input.additionalInfo) form.set("additional_info", input.additionalInfo);

    for (const img of input.images.slice(0, 5)) {
      const bytes = Buffer.from(img.base64, "base64");
      const blob = new Blob([bytes], { type: img.mime || "image/jpeg" });
      form.append("images[]", blob, img.filename || "card.jpg");
    }

    const json = await sogoFetch<{ data: SogoSellResponse }>(
      "/gift-cards/sell",
      {
        method: "POST",
        body: form,
        idempotencyKey: input.idempotencyKey,
      },
    );
    return { data: json.data, simulated: false };
  }

  const json = await sogoFetch<{ data: SogoSellResponse }>("/gift-cards/sell", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      slug: input.slug,
      card_country: input.cardCountry,
      card_type: input.cardType,
      ...(input.subType ? { sub_type: input.subType } : {}),
      card_currency: input.cardCurrency,
      card_amount: input.cardAmount,
      ...(input.additionalInfo
        ? { additional_info: input.additionalInfo }
        : {}),
      payout_currency: input.payoutCurrency || "NGN",
      ...(input.specificCountry
        ? { specific_country: input.specificCountry }
        : {}),
    }),
  });

  return { data: json.data, simulated: false };
}
