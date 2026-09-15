/**
 * AnyMessage temporary-email client (site inbox OTP).
 * Docs: https://anymessage.shop/en/docs
 * Base: https://api.anymessage.shop
 */

const DEFAULT_BASE = "https://api.anymessage.shop";
const LOG_PREFIX = "[anymessage]";

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

export function anymessageApiToken() {
  return cleanEnv(
    process.env.ANYMESSAGE_API_TOKEN ||
      process.env.ANYMESSAGE_TOKEN ||
      process.env.ANYMESSAGE_API_KEY ||
      "",
  );
}

export function anymessageBaseUrl() {
  return cleanEnv(process.env.ANYMESSAGE_BASE_URL || DEFAULT_BASE).replace(
    /\/$/,
    "",
  );
}

export function hasAnymessageKeys() {
  return Boolean(anymessageApiToken());
}

export function isAnymessageDemoForced() {
  const flag = cleanEnv(process.env.ANYMESSAGE_DEMO || "").toLowerCase();
  return flag === "true" || flag === "1";
}

export function isAnymessageLive() {
  return hasAnymessageKeys() && !isAnymessageDemoForced();
}

export function isAnymessageDemoMode() {
  return !isAnymessageLive();
}

export function anymessageMarkup() {
  const raw = Number(
    process.env.ANYMESSAGE_MARKUP ||
      process.env.HEROSMS_MARKUP ||
      process.env.FIVESIM_MARKUP ||
      "1.15",
  );
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.15;
}

/** Fallback wholesale USD when quantity payload has no price. */
export function anymessageDefaultEmailUsd() {
  const raw = Number(process.env.ANYMESSAGE_DEFAULT_EMAIL_USD || "0.05");
  return Number.isFinite(raw) && raw > 0 ? raw : 0.05;
}

let loggedMode = false;
function logModeOnce() {
  if (loggedMode) return;
  loggedMode = true;
  console.log(LOG_PREFIX, "mode", {
    live: isAnymessageLive(),
    hasKey: hasAnymessageKeys(),
    key: maskKey(anymessageApiToken()),
    base: anymessageBaseUrl(),
    markup: anymessageMarkup(),
  });
}

const ERROR_EN: Record<string, string> = {
  token: "Email service credentials are invalid. Contact ORYNO support.",
  site: "Select a valid site.",
  domain: "Select a valid email domain.",
  "no activation": "Email activation not found.",
  "activation canceled": "This email was cancelled.",
  "activation already canceled": "This email was already cancelled.",
  "no balance":
    "No emails available right now. Try another domain or try again later.",
  "no emails": "No emails available for that site and domain. Try another one.",
  "email banned": "That inbox is blocked. Try another domain.",
  "wait message": "Waiting for email…",
  "ratio block":
    "That site/domain is temporarily blocked. Try another combination.",
};

export function anymessageErrorToEnglish(raw: unknown) {
  const text = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return "Something went wrong. Please try again.";
  const lower = text.toLowerCase();
  if (ERROR_EN[lower]) return ERROR_EN[lower];
  for (const [key, en] of Object.entries(ERROR_EN)) {
    if (lower.includes(key)) return en;
  }
  if (lower.includes("insufficient usd") || lower.includes("usd card")) {
    return text;
  }
  return text.length > 160 ? "Email request failed" : text;
}

type AnyMessageJson = {
  status?: string;
  value?: string;
  balance?: number | string;
  id?: string | number;
  email?: string;
  message?: string;
  data?: unknown;
};

async function amFetch(
  path: string,
  params: Record<string, string | number | undefined> = {},
) {
  logModeOnce();
  const token = anymessageApiToken();
  if (!token) throw new Error("ANYMESSAGE_API_TOKEN is not configured");

  const qs = new URLSearchParams();
  qs.set("token", token);
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") continue;
    qs.set(k, String(v));
  }

  const url = `${anymessageBaseUrl()}${path}?${qs.toString()}`;
  console.log(LOG_PREFIX, "request", { path, params: { ...params, token: "***" } });

  const started = Date.now();
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Oryno/1.0",
    },
    cache: "no-store",
  });
  const text = await res.text();
  console.log(LOG_PREFIX, "response", {
    path,
    status: res.status,
    ms: Date.now() - started,
    body: truncate(text),
  });

  let json: AnyMessageJson = {};
  try {
    json = text ? (JSON.parse(text) as AnyMessageJson) : {};
  } catch {
    throw new Error(anymessageErrorToEnglish(text || `AnyMessage error (${res.status})`));
  }

  if (!res.ok || json.status === "error") {
    throw new Error(
      anymessageErrorToEnglish(json.value || text || `AnyMessage error (${res.status})`),
    );
  }

  return json;
}

export async function getAnymessageBalance() {
  const json = await amFetch("/user/balance");
  return Number(json.balance) || 0;
}

export async function assertAnymessageReady(minUsd = 0.01) {
  if (!isAnymessageLive()) {
    throw new Error(
      "AnyMessage is not configured. Set ANYMESSAGE_API_TOKEN and ANYMESSAGE_DEMO=false.",
    );
  }
  const balance = await getAnymessageBalance();
  if (balance < minUsd) {
    console.error(LOG_PREFIX, "provider wallet empty", { balance, minUsd });
    throw new Error("no balance");
  }
  return balance;
}

export type AnymessageDomainOffer = {
  name: string;
  cost: number;
  count: number;
};

function normalizeDomainKey(raw: string) {
  const key = raw.trim().toLowerCase().replace(/^@/, "");
  // AnyMessage sometimes returns "gmx" / "mailcom" without TLD
  const aliases: Record<string, string> = {
    gmx: "gmx.com",
    mailcom: "mail.com",
    hotmail: "hotmail.com",
    outlook: "outlook.com",
    yahoo: "yahoo.com",
    gmail: "gmail.com",
    yandex: "yandex.com",
    rambler: "rambler.ru",
  };
  return aliases[key] || key;
}

/**
 * GET /email/quantity?site=
 * data shapes observed:
 *  { "gmx.com": 12 }
 *  { "hotmail.com": { count: 12, price: 0.04 } }
 */
export async function getAnymessageEmailDomains(site: string) {
  const normalized = normalizeEmailSite(site);
  if (!normalized) throw new Error("Site is required to load domains");

  const json = await amFetch("/email/quantity", { site: normalized });
  const raw = (json.data ?? {}) as Record<string, unknown>;
  const fallback = anymessageDefaultEmailUsd();
  const out: AnymessageDomainOffer[] = [];

  for (const [domainKey, value] of Object.entries(raw)) {
    const name = normalizeDomainKey(domainKey);
    if (!name) continue;

    let count = 0;
    let cost = fallback;
    if (typeof value === "number") {
      count = value;
    } else if (value && typeof value === "object") {
      const row = value as Record<string, unknown>;
      count = Number(row.count ?? row.qty ?? row.quantity ?? 0) || 0;
      const price = Number(row.price ?? row.cost ?? 0);
      if (Number.isFinite(price) && price > 0) cost = price;
    }
    if (count <= 0) continue;
    out.push({ name, cost, count });
  }

  out.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  console.log(LOG_PREFIX, "email domains", {
    site: normalized,
    count: out.length,
  });
  return out;
}

export async function purchaseAnymessageEmail(input: {
  site: string;
  domain: string;
}) {
  const site = normalizeEmailSite(input.site);
  const domain = input.domain.trim().toLowerCase().replace(/^@/, "");
  if (!site || !domain) throw new Error("Site and domain are required");

  // Prefer full domain; also try short alias if API expects it
  const shortAliases: Record<string, string> = {
    "gmx.com": "gmx",
    "mail.com": "mailcom",
    "hotmail.com": "hotmail",
    "outlook.com": "outlook",
    "yahoo.com": "yahoo",
    "gmail.com": "gmail",
  };
  const domainParam = shortAliases[domain] || domain;

  const json = await amFetch("/email/order", {
    site,
    domain: domainParam,
  });

  const emailId = String(json.id ?? "").trim();
  const email = String(json.email ?? "").trim();
  if (!emailId || !email) {
    throw new Error("No email returned from provider");
  }

  return { emailId, email, site, domain };
}

export async function getAnymessageEmailMessage(emailId: string) {
  try {
    const json = await amFetch("/email/getmessage", { id: emailId });
    const message =
      typeof json.message === "string"
        ? json.message
        : typeof json.value === "string"
          ? json.value
          : "";
    return {
      message,
      value: extractCode(message),
      status: message ? "OK" : "PENDING",
      raw: json,
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes("wait") || lower.includes("pending")) {
      return { message: "", value: "", status: "PENDING" as const, raw: null };
    }
    throw error;
  }
}

export async function cancelAnymessageEmail(emailId: string) {
  const json = await amFetch("/email/cancel", { id: emailId });
  const value = String(json.value || "").toLowerCase();
  if (value && !value.includes("cancel")) {
    throw new Error(anymessageErrorToEnglish(json.value));
  }
  return { ok: true, emailId };
}

function extractCode(message: string) {
  const text = String(message || "");
  const match =
    text.match(/\b(\d{4,8})\b/) || text.match(/\b([A-Z0-9]{4,10})\b/i);
  return match?.[1]?.trim() || "";
}

/** Demo domains when AnyMessage is offline. */
export const FALLBACK_EMAIL_DOMAINS = [
  { name: "gmx.com", cost: 0.002, count: 100 },
  { name: "mail.com", cost: 0.002, count: 80 },
  { name: "email.com", cost: 0.002, count: 70 },
  { name: "hotmail.com", cost: 0.003, count: 40 },
  { name: "outlook.com", cost: 0.003, count: 40 },
  { name: "gmail.com", cost: 0.01, count: 10 },
];

/** Normalize signup site for email rentals (host only, lowercase). */
export function normalizeEmailSite(site: string) {
  return site
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/[?#].*$/, "");
}
