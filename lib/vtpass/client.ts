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
  // Default to sandbox when using keys that look like sandbox / no explicit live
  return true;
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
    response_description?: string;
  };

  if (!res.ok) {
    throw new Error(
      json.response_description || `VTpass error (${res.status})`,
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

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}
