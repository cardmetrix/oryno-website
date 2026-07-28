import { mapHeroCountry, type HeroCountry, type HeroService } from "./catalog";
import { herosmsErrorToEnglish, normalizeEmailSite } from "./errors";

const DEFAULT_BASE = "https://hero-sms.com/stubs/handler_api.php";
const EMAIL_BASE = "https://hero-sms.com/api/v1";

export function herosmsApiKey() {
  return (process.env.HEROSMS_API_KEY || "").trim();
}

export function herosmsBaseUrl() {
  return (
    process.env.HEROSMS_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE
  );
}

export function herosmsEmailBaseUrl() {
  return (
    process.env.HEROSMS_EMAIL_BASE_URL?.trim().replace(/\/$/, "") || EMAIL_BASE
  );
}

export function hasHerosmsKeys() {
  return Boolean(herosmsApiKey());
}

export function isHerosmsDemoMode() {
  return !hasHerosmsKeys();
}

/** Retail markup on top of FX buy rate (default 15%). */
export function herosmsMarkup() {
  const raw = Number(process.env.HEROSMS_MARKUP || "1.15");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.15;
}

async function heroGet(action: string, params: Record<string, string | number> = {}) {
  const key = herosmsApiKey();
  if (!key) throw new Error("HEROSMS_API_KEY is not configured");

  const qs = new URLSearchParams({
    api_key: key,
    action,
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
  });

  const res = await fetch(`${herosmsBaseUrl()}?${qs.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  return { status: res.status, text };
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function getHerosmsBalance() {
  const { text } = await heroGet("getBalance");
  // ACCESS_BALANCE:123.45
  if (text.startsWith("ACCESS_BALANCE:")) {
    return Number(text.split(":")[1]);
  }
  const json = tryParseJson(text) as { balance?: number } | null;
  if (json && typeof json.balance === "number") return json.balance;
  throw new Error(text || "Failed to get HeroSMS balance");
}

export async function getHerosmsCountries(): Promise<HeroCountry[]> {
  const { text } = await heroGet("getCountries");
  const json = tryParseJson(text);
  if (!json || typeof json !== "object") {
    throw new Error("Failed to load countries");
  }

  const rows = Object.values(json as Record<string, Record<string, unknown>>);
  return rows
    .map((row) =>
      mapHeroCountry({
        id: row.id as number,
        eng: row.eng as string | undefined,
        rus: row.rus as string | undefined,
        visible: row.visible as number | undefined,
        rent: row.rent as number | undefined,
      }),
    )
    .filter((c) => c.visible)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getHerosmsServices(): Promise<HeroService[]> {
  const { text } = await heroGet("getServicesList");
  const json = tryParseJson(text) as {
    status?: string;
    services?: { code: string; name: string }[];
  } | null;

  if (json?.services?.length) {
    return json.services.map((s) => ({
      code: s.code,
      name: s.name,
    }));
  }
  throw new Error(text || "Failed to load services");
}

/**
 * getPrices returns nested map:
 * { [countryId]: { [service]: { cost, count, ... } } }
 * or with service filter: { [countryId]: { cost, count } }
 */
export async function getHerosmsPrices(options?: {
  service?: string;
  country?: number;
}) {
  const params: Record<string, string | number> = {};
  if (options?.service) params.service = options.service;
  if (options?.country != null) params.country = options.country;

  const { text } = await heroGet("getPrices", params);
  const json = tryParseJson(text);
  if (!json || typeof json !== "object") {
    throw new Error(text || "Failed to load prices");
  }
  return json as Record<string, unknown>;
}

export async function getHerosmsNumber(input: {
  service: string;
  country: number;
  maxPrice?: number;
  operator?: string;
}) {
  const params: Record<string, string | number> = {
    service: input.service,
    country: input.country,
  };
  if (input.maxPrice != null && Number.isFinite(input.maxPrice)) {
    params.maxPrice = input.maxPrice;
  }
  if (input.operator) params.operator = input.operator;

  const tryOnce = async (p: Record<string, string | number>) => {
    const { text } = await heroGet("getNumber", p);
    if (text.startsWith("ACCESS_NUMBER:")) {
      const parts = text.split(":");
      const activationId = parts[1];
      const phoneNumber = parts.slice(2).join(":");
      return {
        activationId,
        phoneNumber: phoneNumber?.startsWith("+")
          ? phoneNumber
          : `+${phoneNumber}`,
      };
    }
    const json = tryParseJson(text) as {
      activationId?: string | number;
      phone?: string | number;
      number?: string | number;
      error?: string;
    } | null;
    if (json?.activationId != null && (json.phone || json.number)) {
      const phone = String(json.phone || json.number);
      return {
        activationId: String(json.activationId),
        phoneNumber: phone.startsWith("+") ? phone : `+${phone}`,
      };
    }
    throw new Error(json?.error || text || "Failed to get number");
  };

  try {
    return await tryOnce(params);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Retry without maxPrice when the provider rejects the ceiling
    if (/WRONG_MAX_PRICE/i.test(msg) && params.maxPrice != null) {
      const { maxPrice: _drop, ...rest } = params;
      return tryOnce(rest);
    }
    throw new Error(herosmsErrorToEnglish(msg));
  }
}

export async function getHerosmsStatus(activationId: string) {
  const { text } = await heroGet("getStatus", { id: activationId });
  if (text.startsWith("STATUS_OK:")) {
    return { status: "STATUS_OK" as const, code: text.split(":")[1] ?? "" };
  }
  if (text === "STATUS_WAIT_CODE" || text.startsWith("STATUS_WAIT")) {
    return { status: "STATUS_WAIT_CODE" as const, code: null };
  }
  if (text === "STATUS_CANCEL") {
    return { status: "STATUS_CANCEL" as const, code: null };
  }
  if (text.startsWith("STATUS_OK")) {
    return { status: "STATUS_OK" as const, code: text.replace("STATUS_OK:", "") };
  }
  return { status: text, code: null };
}

export async function setHerosmsStatus(
  activationId: string,
  status: 1 | 3 | 6 | 8,
) {
  const { text } = await heroGet("setStatus", {
    id: activationId,
    status,
  });
  return text;
}

async function emailFetch(
  path: string,
  init?: RequestInit,
) {
  const key = herosmsApiKey();
  if (!key) throw new Error("Email service is not configured");

  // HeroSMS email REST accepts Authorization: ApiKey <token> (and some accounts use raw token).
  const authStyles = [`ApiKey ${key}`, key] as const;
  let lastError = "Failed to reach email service";

  for (const authorization of authStyles) {
    const res = await fetch(`${herosmsEmailBaseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: authorization,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as {
      data?: unknown;
      meta?: unknown;
      title?: string;
      details?: string | Record<string, unknown>;
      message?: string;
    } | null;

    if (res.ok) return json;

    const details =
      typeof json?.details === "string"
        ? json.details
        : json?.details
          ? JSON.stringify(json.details)
          : null;
    const raw =
      details ||
      json?.message ||
      json?.title ||
      `Email service error (${res.status})`;
    lastError = herosmsErrorToEnglish(raw);

    // Retry next auth style on auth / validation failures only
    if (res.status !== 401 && res.status !== 403 && res.status !== 400) {
      break;
    }
  }

  throw new Error(lastError);
}

export async function getHerosmsEmailDomains() {
  const json = await emailFetch("/emails/domains");
  const data = (json?.data ?? []) as {
    name: string;
    cost: number;
    count: number;
  }[];
  return data;
}

const SITE_SERVICE_CODES: Record<string, string> = {
  "telegram.com": "tg",
  "google.com": "go",
  "gmail.com": "go",
  "instagram.com": "ig",
  "facebook.com": "fb",
  "discord.com": "ds",
  "openai.com": "ot",
  "whatsapp.com": "wa",
  "tiktok.com": "lf",
  "twitter.com": "tw",
  "x.com": "tw",
};

export async function purchaseHerosmsEmail(input: {
  site: string;
  domain: string;
  service?: string;
}) {
  const site = normalizeEmailSite(input.site);
  const domain = input.domain.trim().toLowerCase().replace(/^@/, "");
  if (!site || !domain) {
    throw new Error("Site and domain are required");
  }

  const service =
    input.service?.trim() || SITE_SERVICE_CODES[site] || undefined;

  const json = await emailFetch("/emails", {
    method: "POST",
    body: JSON.stringify({
      site,
      domain,
      ...(service ? { service } : {}),
    }),
  });
  const data = json?.data as
    | {
        id?: number | string;
        email?: string;
        site?: string;
        domain?: string;
        cost?: number;
        status?: string | number;
      }
    | Array<{
        id?: number | string;
        email?: string;
        site?: string;
        domain?: string;
        cost?: number;
      }>;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.email) throw new Error("No email returned from the email service");
  return {
    emailId: String(row.id ?? ""),
    email: row.email,
    site: row.site || site,
    domain: row.domain || domain,
    costUsd: Number(row.cost) || 0,
  };
}

export async function getHerosmsEmailStatus(emailId: string) {
  const json = await emailFetch(`/emails/${encodeURIComponent(emailId)}`);
  return json?.data as {
    id?: number;
    site?: string;
    email?: string;
    status?: string;
    value?: string;
    cost?: number;
    message?: string;
  };
}

export async function cancelHerosmsEmail(emailId: string) {
  return emailFetch(`/emails/${encodeURIComponent(emailId)}`, {
    method: "DELETE",
  });
}
