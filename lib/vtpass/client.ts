import crypto from "crypto";
import type {
  VtpassIntlCountry,
  VtpassIntlOperator,
  VtpassIntlProductType,
  VtpassPayPayload,
  VtpassPayResponse,
  VtpassService,
  VtpassVariation,
  VtpassVerifyResult,
} from "./types";

const LIVE_BASE = "https://vtpass.com/api";
const SANDBOX_BASE = "https://sandbox.vtpass.com/api";

export function vtpassApiKey() {
  return (process.env.VTPASS_API_KEY || "").trim();
}

export function vtpassPublicKey() {
  return (process.env.VTPASS_PUBLIC_KEY || "").trim();
}

export function vtpassSecretKey() {
  return (process.env.VTPASS_SECRET_KEY || "").trim();
}

export function isVtpassSandbox() {
  const flag = (process.env.VTPASS_SANDBOX || "").toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Prefer live when unset — production must opt into sandbox explicitly
  return false;
}

export function vtpassBaseUrl() {
  const custom = (process.env.VTPASS_BASE_URL || "").trim();
  if (custom) return custom.replace(/\/$/, "");
  return isVtpassSandbox() ? SANDBOX_BASE : LIVE_BASE;
}

export function hasVtpassKeys() {
  return Boolean(vtpassApiKey() && vtpassPublicKey() && vtpassSecretKey());
}

/** Demo mode when keys are missing — catalog + simulated purchases. */
export function isVtpassDemoMode() {
  return !hasVtpassKeys();
}

/**
 * VTpass request_id: first 12 chars = YYYYMMDDHHmm in Africa/Lagos,
 * then unique alphanumeric suffix. Must be ≥ 12 chars.
 */
export function generateVtpassRequestId(prefix = "ORY") {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "00";

  const stamp = `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}`;
  const suffix = crypto.randomBytes(6).toString("hex");
  return `${stamp}${prefix}${suffix}`.slice(0, 30);
}

async function vtpassFetch<T>(
  path: string,
  init?: RequestInit & { method?: "GET" | "POST" },
): Promise<T> {
  if (!hasVtpassKeys()) {
    throw new Error("VTpass API keys are not configured");
  }

  const method = (init?.method ?? "GET").toUpperCase() as "GET" | "POST";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "api-key": vtpassApiKey(),
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (method === "GET") {
    headers["public-key"] = vtpassPublicKey();
  } else {
    headers["secret-key"] = vtpassSecretKey();
  }

  const res = await fetch(`${vtpassBaseUrl()}${path}`, {
    ...init,
    method,
    headers,
    cache: "no-store",
  });

  const json = (await res.json()) as T & {
    code?: string;
    message?: string;
    response_description?: string;
  };

  if (!res.ok) {
    const detail =
      json.response_description ||
      json.message ||
      (json.code ? `Provider error (${json.code})` : null) ||
      `VTpass error (${res.status})`;
    const lower = detail.toLowerCase();
    if (lower.includes("invalid credential") || json.code === "087") {
      throw new Error(
        isVtpassSandbox()
          ? "VTpass sandbox rejected these API keys. Paste the api-key, public-key, and secret-key from sandbox.vtpass.com → Profile → API Keys, then restart the app."
          : "VTpass live rejected these API keys. Sandbox keys only work with VTPASS_SANDBOX=true. For production, use live keys after VTpass approves API access (or set VTPASS_SANDBOX=true while testing).",
      );
    }
    throw new Error(detail);
  }

  // Some VTpass failures still return HTTP 200 with an error code.
  // Leave success/pending codes to the purchase layer; reject hard auth errors here.
  const code = String(json.code || "");
  if (code === "091" || code === "092" || code === "093") {
    throw new Error(
      json.response_description ||
        "Airtime provider authentication failed. Check VTpass API keys.",
    );
  }

  return json;
}

export async function getVtpassServices(identifier: string) {
  const data = await vtpassFetch<{
    response_description?: string;
    content?: VtpassService[];
  }>(`/services?identifier=${encodeURIComponent(identifier)}`);
  return data.content ?? [];
}

export async function getVtpassVariations(
  serviceID: string,
  params?: { operator_id?: string | number; product_type_id?: string | number },
) {
  const qs = new URLSearchParams({ serviceID });
  if (params?.operator_id != null) qs.set("operator_id", String(params.operator_id));
  if (params?.product_type_id != null) {
    qs.set("product_type_id", String(params.product_type_id));
  }

  const data = await vtpassFetch<{
    response_description?: string;
    content?: {
      ServiceName?: string;
      serviceID?: string;
      variations?: VtpassVariation[];
    };
  }>(`/service-variations?${qs.toString()}`);

  return {
    serviceName: data.content?.ServiceName ?? serviceID,
    serviceID: data.content?.serviceID ?? serviceID,
    variations: data.content?.variations ?? [],
  };
}

export async function verifyVtpassCustomer(input: {
  billersCode: string;
  serviceID: string;
  type?: string;
}) {
  return vtpassFetch<VtpassVerifyResult>("/merchant-verify", {
    method: "POST",
    body: JSON.stringify({
      billersCode: input.billersCode,
      serviceID: input.serviceID,
      ...(input.type ? { type: input.type } : {}),
    }),
  });
}

export async function payVtpass(payload: VtpassPayPayload) {
  return vtpassFetch<VtpassPayResponse>("/pay", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requeryVtpass(requestId: string) {
  return vtpassFetch<VtpassPayResponse>("/requery", {
    method: "POST",
    body: JSON.stringify({ request_id: requestId }),
  });
}

export async function getVtpassBalance() {
  return vtpassFetch<{
    contents?: { balance?: number };
    content?: { balance?: number };
  }>("/balance");
}

export async function getIntlAirtimeCountries() {
  const data = await vtpassFetch<{
    content?: { countries?: VtpassIntlCountry[] };
  }>("/get-international-airtime-countries");
  return data.content?.countries ?? [];
}

export async function getIntlAirtimeProductTypes(code: string) {
  const data = await vtpassFetch<{ content?: VtpassIntlProductType[] }>(
    `/get-international-airtime-product-types?code=${encodeURIComponent(code)}`,
  );
  return data.content ?? [];
}

export async function getIntlAirtimeOperators(
  code: string,
  productTypeId: string | number,
) {
  const data = await vtpassFetch<{ content?: VtpassIntlOperator[] }>(
    `/get-international-airtime-operators?code=${encodeURIComponent(code)}&product_type_id=${encodeURIComponent(String(productTypeId))}`,
  );
  return data.content ?? [];
}

/** VTpass success codes commonly used across products */
export function isVtpassSuccessCode(code?: string | null) {
  return code === "000" || code === "00" || code === "0";
}

export function isVtpassPendingCode(code?: string | null) {
  return code === "099" || code === "01";
}

/**
 * Normalize recipient phone for VTpass.
 * Nigerian numbers must be local `0XXXXXXXXXX` (not `234…` / bare 10 digits).
 */
export function normalizePhone(phone: string, countryCode?: string | null) {
  let digits = phone.replace(/\D/g, "");
  const country = (countryCode || "").toUpperCase();
  const looksNg =
    country === "NG" ||
    digits.startsWith("234") ||
    (digits.startsWith("0") && digits.length === 11) ||
    (digits.length === 10 && /^[789]/.test(digits));

  if (looksNg) {
    if (digits.startsWith("234") && digits.length >= 12) {
      digits = `0${digits.slice(3)}`;
    }
    if (digits.length === 10 && /^[789]/.test(digits)) {
      digits = `0${digits}`;
    }
  }

  return digits;
}

/** Sandbox only delivers for these simulated phones (VTpass docs). */
export function isVtpassSandboxTestPhone(phone: string) {
  const digits = normalizePhone(phone, "NG");
  return (
    digits === "08011111111" ||
    digits === "201000000000" ||
    digits === "500000000000" ||
    digits === "400000000000" ||
    digits === "300000000000"
  );
}
