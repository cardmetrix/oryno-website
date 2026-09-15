/**
 * Shared Pairgate HTTP helpers.
 * Docs: https://pairgate.com/developers/introduction
 */

import { createHmac, timingSafeEqual } from "crypto";

function cleanEnv(raw: string) {
  return raw
    .split("#")[0]
    .trim()
    .replace(/^["']|["']$/g, "");
}

export function pairgateApiKey() {
  return cleanEnv(process.env.PAIRGATE_API_KEY || "");
}

export function pairgateWebhookSecret() {
  return cleanEnv(process.env.PAIRGATE_WEBHOOK_SECRET || "");
}

export function pairgateBaseUrl() {
  return cleanEnv(
    process.env.PAIRGATE_BASE_URL || "https://pairgate.com/api/v1",
  ).replace(/\/$/, "");
}

export function isPairgateSandbox() {
  const flag = cleanEnv(
    process.env.PAIRGATE_SANDBOX || process.env.PAIRGATE_DEMO || "",
  ).toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function hasPairgateKeys() {
  return Boolean(pairgateApiKey());
}

export function pairgateApiPath(livePath: string, testPath: string) {
  return isPairgateSandbox() ? testPath : livePath;
}

export type PairgateEnvelope = {
  code?: number;
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  errors?: unknown;
};

export async function pairgateFetch(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; json: PairgateEnvelope }> {
  const res = await fetch(`${pairgateBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${pairgateApiKey()}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: PairgateEnvelope = {};
  try {
    json = JSON.parse(text) as PairgateEnvelope;
  } catch {
    const err = new Error("Pairgate returned an invalid response") as Error & {
      status?: number;
    };
    err.status = 503;
    throw err;
  }
  return { ok: res.ok, status: res.status, json };
}

export function pairgateErrorMessage(json: PairgateEnvelope, fallback: string) {
  if (typeof json.message === "string" && json.message.trim()) return json.message;
  if (typeof json.data?.message === "string") return String(json.data.message);
  if (typeof json.status === "string" && json.status !== "success") {
    return json.status;
  }
  return fallback;
}

export function isPairgateHttpOk(
  ok: boolean,
  status: number,
  json: PairgateEnvelope,
) {
  return ok || status === 200 || Number(json.code) === 200;
}

export function isPairgateDataSuccess(data: Record<string, unknown>, json: PairgateEnvelope) {
  return (
    data.status === true ||
    data.status === "true" ||
    json.status === "success" ||
    Boolean(data.test_mode)
  );
}

/**
 * Verify Pairgate webhook HMAC.
 * signature = HMAC_SHA256(secret, `${timestamp}.${rawBody}`) hex
 */
export function verifyPairgateWebhookSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  maxAgeSeconds?: number;
}): { ok: boolean; message?: string } {
  const secret = pairgateWebhookSecret();
  if (!secret) {
    return { ok: true };
  }
  if (!input.timestamp || !input.signature) {
    return { ok: false, message: "Missing Pairgate signature headers" };
  }

  const ts = Number(input.timestamp);
  const maxAge = input.maxAgeSeconds ?? 300;
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > maxAge) {
    return { ok: false, message: "Webhook expired" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${input.timestamp}.${input.rawBody}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(input.signature, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, message: "Invalid signature" };
    }
  } catch {
    return { ok: false, message: "Invalid signature" };
  }

  return { ok: true };
}

export type PairgateWebhookPayload = {
  event?: string;
  reference?: string | null;
  reference_code?: string;
  status?: string;
  message?: string;
  item?: string;
  plan?: string;
  recipient?: string;
  amount?: number;
  pin?: string;
  completed_at?: string;
};

/** Client reference: 8–100 chars for Pairgate purchase endpoints. */
export function generatePairgateReference(prefix: string) {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}${stamp}${rand}`.slice(0, 100);
}
