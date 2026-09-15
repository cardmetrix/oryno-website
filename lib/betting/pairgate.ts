/**
 * Pairgate betting rail (Nigeria).
 * Docs: https://pairgate.com/developers/betting-verify
 *       https://pairgate.com/developers/betting-purchase
 *       https://pairgate.com/developers/webhooks
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

function apiPath(livePath: string, testPath: string) {
  return isPairgateSandbox() ? testPath : livePath;
}

type PairgateEnvelope = {
  code?: number;
  status?: string;
  message?: string;
  data?: Record<string, unknown>;
  errors?: unknown;
};

async function pairgateFetch(
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

function errorMessage(json: PairgateEnvelope, fallback: string) {
  if (typeof json.message === "string" && json.message.trim()) return json.message;
  if (typeof json.data?.message === "string") return String(json.data.message);
  if (typeof json.status === "string" && json.status !== "success") {
    return json.status;
  }
  return fallback;
}

export async function pairgateVerify(input: {
  serviceID: string;
  customerId: string;
}): Promise<{ ok: boolean; customerName: string | null; message?: string }> {
  const path = apiPath("/bet/verify", "/test/bet/verify");
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify({
      provider_id: input.serviceID.trim().toLowerCase(),
      customer_id: input.customerId,
    }),
  });

  const data = json.data || {};
  const valid = data.status === true || data.status === "true";
  const name = String(data.customer_name || "").trim();
  const httpOk = ok || status === 200 || Number(json.code) === 200;

  if (!httpOk) {
    return {
      ok: false,
      customerName: null,
      message: errorMessage(json, "Could not verify betting account"),
    };
  }

  if (!valid || !name) {
    return {
      ok: false,
      customerName: null,
      message: errorMessage(json, "Could not verify betting account"),
    };
  }

  return { ok: true, customerName: name };
}

export async function pairgateFund(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  recipientName?: string | null;
}): Promise<{ ok: boolean; reference: string; message?: string }> {
  const path = apiPath("/bet/purchase", "/test/bet/purchase");
  const body: Record<string, unknown> = {
    provider_id: input.serviceID.trim().toLowerCase(),
    amount: Math.round(input.amount),
    customer_id: input.customerId,
    reference: input.reference.slice(0, 100),
  };
  if (input.recipientName?.trim()) {
    body.recipient_name = input.recipientName.trim();
  }

  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = json.data || {};
  const referenceCode = String(
    data.reference_code || input.reference,
  ).trim();

  if (isPairgateSandbox() && data.test_mode) {
    return {
      ok: true,
      reference: referenceCode || `TEST-${input.reference}`,
      message: String(data.message || "Test betting wallet funded"),
    };
  }

  const success =
    (ok || status === 200 || Number(json.code) === 200) &&
    (data.status === true || data.status === "true" || json.status === "success");

  if (!success) {
    return {
      ok: false,
      reference: input.reference,
      message: errorMessage(json, "Betting funding failed"),
    };
  }

  return {
    ok: true,
    reference: referenceCode,
    message: String(data.message || "Betting wallet funded"),
  };
}

export async function pairgateTransactionStatus(referenceCode: string) {
  const path = `/transaction/status?reference_code=${encodeURIComponent(referenceCode)}`;
  const { ok, json } = await pairgateFetch(path, { method: "GET" });
  const data = json.data || json;
  return {
    ok,
    status: String((data as Record<string, unknown>).status || ""),
    data: data as Record<string, unknown>,
  };
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
    // Secret not configured — accept (dashboard verification may be off)
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
