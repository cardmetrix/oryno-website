import { mapHeroCountry, type HeroCountry, type HeroService } from "./catalog";
import { herosmsErrorToEnglish, normalizeEmailSite } from "./errors";

const DEFAULT_BASE = "https://hero-sms.com/stubs/handler_api.php";
const EMAIL_BASE = "https://hero-sms.com/api/v1";

const LOG_PREFIX = "[herosms]";

function truncate(value: string, max = 400) {
  const s = value.replace(/\s+/g, " ").trim();
  return s.length <= max ? s : `${s.slice(0, max)}…`;
}

function maskKey(key: string) {
  if (!key) return "(empty)";
  if (key.length <= 8) return "****";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

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

/**
 * Force demo catalog/purchases even when a key is set.
 * HEROSMS_DEMO=true|1 → demo; false|0 → live (if key present).
 */
export function isHerosmsDemoForced() {
  const flag = (process.env.HEROSMS_DEMO || "").toLowerCase();
  return flag === "true" || flag === "1";
}

/** Live when API key is present and HEROSMS_DEMO is not forcing demo. */
export function isHerosmsLive() {
  return hasHerosmsKeys() && !isHerosmsDemoForced();
}

/** Demo mode when keys are missing or HEROSMS_DEMO=true. */
export function isHerosmsDemoMode() {
  return !isHerosmsLive();
}

/** Retail markup on top of FX buy rate (default 15%). */
export function herosmsMarkup() {
  const raw = Number(process.env.HEROSMS_MARKUP || "1.15");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.15;
}

let loggedMode = false;
function logHerosmsModeOnce() {
  if (loggedMode) return;
  loggedMode = true;
  console.log(LOG_PREFIX, "mode", {
    live: isHerosmsLive(),
    demo: isHerosmsDemoMode(),
    hasKey: hasHerosmsKeys(),
    key: maskKey(herosmsApiKey()),
    smsBase: herosmsBaseUrl(),
    emailBase: herosmsEmailBaseUrl(),
    markup: herosmsMarkup(),
  });
}

async function heroGet(
  action: string,
  params: Record<string, string | number> = {},
) {
  logHerosmsModeOnce();
  const key = herosmsApiKey();
  if (!key) throw new Error("HEROSMS_API_KEY is not configured");

  const qs = new URLSearchParams({
    api_key: key,
    action,
    ...Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ),
  });

  const url = `${herosmsBaseUrl()}?${qs.toString()}`;
  console.log(LOG_PREFIX, "sms request", {
    action,
    params,
    url: url.replace(key, maskKey(key)),
  });

  const started = Date.now();
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  console.log(LOG_PREFIX, "sms response", {
    action,
    status: res.status,
    ms: Date.now() - started,
    body: truncate(text),
  });
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
    const balance = Number(text.split(":")[1]);
    console.log(LOG_PREFIX, "balance", { balance });
    return balance;
  }
  const json = tryParseJson(text) as { balance?: number } | null;
  if (json && typeof json.balance === "number") {
    console.log(LOG_PREFIX, "balance", { balance: json.balance });
    return json.balance;
  }
  throw new Error(text || "Failed to get HeroSMS balance");
}

export async function getHerosmsCountries(): Promise<HeroCountry[]> {
  const { text } = await heroGet("getCountries");
  const json = tryParseJson(text);
  if (!json || typeof json !== "object") {
    throw new Error("Failed to load countries");
  }

  const rows = Object.values(json as Record<string, Record<string, unknown>>);
  const countries = rows
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

  console.log(LOG_PREFIX, "countries", { count: countries.length });
  return countries;
}

export async function getHerosmsServices(): Promise<HeroService[]> {
  const { text } = await heroGet("getServicesList");
  const json = tryParseJson(text) as {
    status?: string;
    services?: { code: string; name: string }[];
  } | null;

  if (json?.services?.length) {
    console.log(LOG_PREFIX, "services", { count: json.services.length });
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
  const keys = Object.keys(json as object);
  console.log(LOG_PREFIX, "prices", {
    service: options?.service,
    country: options?.country,
    countryCount: keys.length,
  });
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
    console.log(LOG_PREFIX, "getNumber", p);
    const { text } = await heroGet("getNumber", p);
    if (text.startsWith("ACCESS_NUMBER:")) {
      const parts = text.split(":");
      const activationId = parts[1];
      const phoneNumber = parts.slice(2).join(":");
      const result = {
        activationId,
        phoneNumber: phoneNumber?.startsWith("+")
          ? phoneNumber
          : `+${phoneNumber}`,
      };
      console.log(LOG_PREFIX, "getNumber ok", result);
      return result;
    }
    const json = tryParseJson(text) as {
      activationId?: string | number;
      phone?: string | number;
      number?: string | number;
      error?: string;
    } | null;
    if (json?.activationId != null && (json.phone || json.number)) {
      const phone = String(json.phone || json.number);
      const result = {
        activationId: String(json.activationId),
        phoneNumber: phone.startsWith("+") ? phone : `+${phone}`,
      };
      console.log(LOG_PREFIX, "getNumber ok", result);
      return result;
    }
    throw new Error(json?.error || text || "Failed to get number");
  };

  try {
    return await tryOnce(params);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(LOG_PREFIX, "getNumber failed", truncate(msg));
    // Retry without maxPrice when the provider rejects the ceiling
    if (/WRONG_MAX_PRICE/i.test(msg) && params.maxPrice != null) {
      console.log(LOG_PREFIX, "getNumber retry without maxPrice");
      const { maxPrice: _drop, ...rest } = params;
      return tryOnce(rest);
    }
    throw new Error(herosmsErrorToEnglish(msg));
  }
}

export async function getHerosmsStatus(activationId: string) {
  const { text } = await heroGet("getStatus", { id: activationId });
  if (text.startsWith("STATUS_OK:")) {
    const result = {
      status: "STATUS_OK" as const,
      code: text.split(":")[1] ?? "",
    };
    console.log(LOG_PREFIX, "number status", { activationId, ...result });
    return result;
  }
  if (text === "STATUS_WAIT_CODE" || text.startsWith("STATUS_WAIT")) {
    const result = { status: "STATUS_WAIT_CODE" as const, code: null };
    console.log(LOG_PREFIX, "number status", { activationId, ...result });
    return result;
  }
  if (text === "STATUS_CANCEL") {
    const result = { status: "STATUS_CANCEL" as const, code: null };
    console.log(LOG_PREFIX, "number status", { activationId, ...result });
    return result;
  }
  if (text.startsWith("STATUS_OK")) {
    const result = {
      status: "STATUS_OK" as const,
      code: text.replace("STATUS_OK:", ""),
    };
    console.log(LOG_PREFIX, "number status", { activationId, ...result });
    return result;
  }
  console.log(LOG_PREFIX, "number status", { activationId, status: text });
  return { status: text, code: null };
}

export async function setHerosmsStatus(
  activationId: string,
  status: 1 | 3 | 6 | 8,
) {
  console.log(LOG_PREFIX, "setStatus", { activationId, status });
  const { text } = await heroGet("setStatus", {
    id: activationId,
    status,
  });
  console.log(LOG_PREFIX, "setStatus result", { activationId, text: truncate(text) });
  return text;
}

type EmailApiJson = {
  data?: unknown;
  meta?: unknown;
  title?: string;
  details?: string | Record<string, unknown>;
  message?: string;
  error?: string;
} | null;

function formatEmailApiError(json: EmailApiJson, status: number) {
  if (typeof json?.details === "string" && json.details.trim()) {
    return herosmsErrorToEnglish(json.details);
  }
  if (json?.details && typeof json.details === "object") {
    const parts = Object.entries(json.details).flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((item) => `${key}: ${String(item)}`);
      }
      if (value == null) return [];
      return [`${key}: ${String(value)}`];
    });
    if (parts.length) return herosmsErrorToEnglish(parts.join("; "));
  }
  const raw =
    json?.message ||
    json?.error ||
    json?.title ||
    `Email service error (${status})`;
  return herosmsErrorToEnglish(raw);
}

async function emailFetch(path: string, init?: RequestInit) {
  logHerosmsModeOnce();
  const key = herosmsApiKey();
  if (!key) throw new Error("Email service is not configured");

  // Working clients use `ApiKey <token>`; some docs show raw token.
  const authStyles = [
    { label: "ApiKey", value: `ApiKey ${key}` },
    { label: "raw", value: key },
  ] as const;
  let lastError = "Failed to reach email service";

  for (let i = 0; i < authStyles.length; i++) {
    const auth = authStyles[i];
    const method = (init?.method || "GET").toUpperCase();
    console.log(LOG_PREFIX, "email request", {
      method,
      path,
      authStyle: auth.label,
      body: init?.body ? truncate(String(init.body)) : undefined,
    });

    const started = Date.now();
    const res = await fetch(`${herosmsEmailBaseUrl()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: auth.value,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as EmailApiJson;

    console.log(LOG_PREFIX, "email response", {
      method,
      path,
      status: res.status,
      ms: Date.now() - started,
      ok: res.ok,
      body: truncate(JSON.stringify(json ?? {})),
    });

    if (res.ok) return json;

    lastError = formatEmailApiError(json, res.status);

    // HeroSMS often returns 400 for bad auth on email REST — try next style.
    if (res.status !== 401 && res.status !== 403 && res.status !== 400) {
      break;
    }
  }

  console.error(LOG_PREFIX, "email error", lastError);
  throw new Error(lastError);
}

/**
 * HeroSMS requires `site` query param: GET /emails/domains?site=telegram.com
 */
export async function getHerosmsEmailDomains(site: string) {
  const normalized = normalizeEmailSite(site);
  if (!normalized) throw new Error("Site is required to load domains");

  const qs = new URLSearchParams({ site: normalized });
  const json = await emailFetch(`/emails/domains?${qs.toString()}`);
  const raw = (json?.data ?? json) as unknown;
  const rows = Array.isArray(raw) ? raw : [];

  const data = rows
    .map((row) => {
      const r = row as { name?: string; cost?: number; count?: number };
      return {
        name: String(r.name || "").trim().toLowerCase(),
        cost: Number(r.cost) || 0,
        count: Number(r.count) || 0,
      };
    })
    .filter((d) => d.name && d.count > 0)
    .sort((a, b) => a.cost - b.cost);

  console.log(LOG_PREFIX, "email domains", {
    site: normalized,
    count: data.length,
  });
  return data;
}

/** SMS-style service codes that help email routing for known sites. */
const SITE_SERVICE_CODES: Record<string, string> = {
  "telegram.com": "tg",
  "google.com": "go",
  "gmail.com": "go",
  "instagram.com": "ig",
  "facebook.com": "fb",
  "discord.com": "ds",
  "whatsapp.com": "wa",
  "tiktok.com": "lf",
  "twitter.com": "tw",
  "x.com": "tw",
};

function parsePurchasedEmail(
  data: unknown,
  fallback: { site: string; domain: string },
) {
  const row = (
    Array.isArray(data) ? data[0] : data
  ) as {
    id?: number | string;
    email?: string;
    site?: string;
    domain?: string;
    cost?: number;
  } | null;

  if (!row?.email) return null;
  return {
    emailId: String(row.id ?? ""),
    email: row.email,
    site: row.site || fallback.site,
    domain: row.domain || fallback.domain,
    costUsd: Number(row.cost) || 0,
  };
}

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

  // Live clients buy with { site, domain } only.
  const service =
    input.service?.trim() || SITE_SERVICE_CODES[site] || undefined;
  const payloads: Record<string, string>[] = [{ site, domain }];
  if (service) payloads.push({ site, domain, service });

  console.log(LOG_PREFIX, "purchase email", { site, domain, service });

  let lastError = "Failed to rent email";
  for (const body of payloads) {
    try {
      const json = await emailFetch("/emails", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const result = parsePurchasedEmail(json?.data ?? json, { site, domain });
      if (!result) {
        lastError = "No email returned from the email service";
        continue;
      }
      console.log(LOG_PREFIX, "purchase email ok", { ...result, body });
      return result;
    } catch (error) {
      lastError =
        error instanceof Error ? error.message : "Failed to rent email";
      console.warn(LOG_PREFIX, "purchase email attempt failed", {
        body,
        error: lastError,
      });
    }
  }

  throw new Error(lastError);
}

export async function getHerosmsEmailStatus(emailId: string) {
  console.log(LOG_PREFIX, "email status", { emailId });
  const json = await emailFetch(`/emails/${encodeURIComponent(emailId)}`);
  const data = json?.data as {
    id?: number;
    site?: string;
    email?: string;
    status?: string;
    value?: string;
    cost?: number;
    message?: string;
  };
  console.log(LOG_PREFIX, "email status result", {
    emailId,
    status: data?.status,
    hasCode: Boolean(data?.value),
  });
  return data;
}

export async function cancelHerosmsEmail(emailId: string) {
  console.log(LOG_PREFIX, "cancel email", { emailId });
  return emailFetch(`/emails/${encodeURIComponent(emailId)}`, {
    method: "DELETE",
  });
}
