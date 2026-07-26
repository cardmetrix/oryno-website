import crypto from "crypto";

const PAYSTACK_BASE = "https://api.paystack.co";

export function paystackSecretKey() {
  return (
    process.env.PAYSTACK_SECRET_KEY ||
    process.env.PAYSTACK_TEST_SECRET_KEY ||
    ""
  ).trim();
}

export function paystackPublicKey() {
  return (
    process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ||
    process.env.PAYSTACK_PUBLIC_KEY ||
    ""
  ).trim();
}

/** True when using Paystack test keys or when no keys (local demo fallback). */
export function isPaystackDemoMode() {
  const key = paystackSecretKey();
  if (!key) return true;
  return key.startsWith("sk_test_");
}

export function hasPaystackKeys() {
  return Boolean(paystackSecretKey());
}

type PaystackResponse<T> = {
  status: boolean;
  message: string;
  data: T;
};

export async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<PaystackResponse<T>> {
  const key = paystackSecretKey();
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not configured");
  }

  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await res.json()) as PaystackResponse<T>;
  if (!res.ok || !json.status) {
    throw new Error(json.message || `Paystack error (${res.status})`);
  }
  return json;
}

export function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
) {
  const key = paystackSecretKey();
  if (!key || !signature) return false;
  const hash = crypto.createHmac("sha512", key).update(rawBody).digest("hex");
  return hash === signature;
}
