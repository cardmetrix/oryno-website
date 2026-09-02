import { isFlutterwaveIpWhitelistError } from "@/lib/flutterwave/errors";

const FLUTTERWAVE_BASE = "https://api.flutterwave.com/v3";

export function flutterwaveSecretKey() {
  return (
    process.env.FLUTTERWAVE_SECRET_KEY ||
    process.env.FLW_SECRET_KEY ||
    process.env.FLUTTERWAVE_TEST_SECRET_KEY ||
    ""
  ).trim();
}

export function flutterwavePublicKey() {
  return (
    process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY ||
    process.env.FLUTTERWAVE_PUBLIC_KEY ||
    process.env.FLW_PUBLIC_KEY ||
    ""
  ).trim();
}

export function flutterwaveWebhookHash() {
  return (
    process.env.FLUTTERWAVE_WEBHOOK_HASH ||
    process.env.FLW_SECRET_HASH ||
    process.env.FLUTTERWAVE_SECRET_HASH ||
    ""
  ).trim();
}

/** True when using Flutterwave test keys or when no keys (local demo fallback). */
export function isFlutterwaveDemoMode() {
  const key = flutterwaveSecretKey();
  if (!key) return true;
  return key.toUpperCase().includes("TEST") || key.startsWith("FLWSECK_TEST");
}

export function hasFlutterwaveKeys() {
  return Boolean(flutterwaveSecretKey());
}

type FlutterwaveResponse<T> = {
  status: string;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export async function flutterwaveFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<FlutterwaveResponse<T>> {
  const key = flutterwaveSecretKey();
  if (!key) {
    throw new Error("FLUTTERWAVE_SECRET_KEY is not configured");
  }

  const res = await fetch(`${FLUTTERWAVE_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  let json: FlutterwaveResponse<T> & { data?: T & { message?: string } };
  try {
    json = (await res.json()) as FlutterwaveResponse<T> & {
      data?: T & { message?: string };
    };
  } catch {
    throw new Error(`Flutterwave error (${res.status})`);
  }
  const okStatus =
    String(json.status || "").toLowerCase() === "success" ||
    String(json.status || "").toLowerCase() === "successful";
  if (!res.ok || !okStatus) {
    const nested =
      json.data && typeof json.data === "object"
        ? String(
            (json.data as { message?: string }).message ||
              (json.data as { response_message?: string }).response_message ||
              "",
          ).trim()
        : "";
    const combined = nested || json.message || `Flutterwave error (${res.status})`;
    throw new Error(
      isFlutterwaveIpWhitelistError(combined)
        ? "Please enable IP whitelisting on your Flutterwave dashboard for this server."
        : combined,
    );
  }
  return json;
}

export function verifyFlutterwaveSignature(signature: string | null) {
  const hash = flutterwaveWebhookHash();
  if (!hash) {
    if (!isFlutterwaveDemoMode()) {
      console.error(
        "[flutterwave-webhook] FLUTTERWAVE_WEBHOOK_HASH is missing — live webhooks are rejected and deposits will not credit automatically",
      );
    }
    return isFlutterwaveDemoMode();
  }
  if (!signature) return false;
  return hash === signature;
}

export function normalizeFlutterwaveMeta(
  raw: unknown,
): Record<string, unknown> | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as { metaname?: string; metavalue?: unknown };
      if (row.metaname) out[row.metaname] = row.metavalue;
    }
    return out;
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function isPaymentSuccessful(status?: string | null) {
  const value = (status || "").toLowerCase();
  return (
    value === "successful" ||
    value === "success" ||
    value === "completed" ||
    value === "succeeded"
  );
}
