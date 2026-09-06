import { ProxyAgent, fetch as undiciFetch } from "undici";

/** Optional static-IP proxy so Flutterwave can whitelist a fixed egress on Vercel Hobby. */
export function flutterwaveProxyUrl() {
  return (
    process.env.FLUTTERWAVE_HTTPS_PROXY ||
    process.env.FLUTTERWAVE_PROXY_URL ||
    process.env.FIXIE_URL ||
    process.env.QUOTAGUARDSTATIC_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    ""
  ).trim();
}

export function hasFlutterwaveProxy() {
  return Boolean(flutterwaveProxyUrl());
}

export function allowFlutterwaveDirect() {
  const value = (process.env.FLUTTERWAVE_ALLOW_DIRECT || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/**
 * Live Flutterwave payouts on Vercel Hobby must use Fixie/QuotaGuard.
 * Without this, Flutterwave sees a random Vercel IP and blocks transfers.
 */
export function assertFlutterwaveProxyConfigured(isDemoMode: boolean) {
  if (isDemoMode || allowFlutterwaveDirect()) return;
  if (hasFlutterwaveProxy()) return;
  throw new Error(
    "FLUTTERWAVE_HTTPS_PROXY is missing on this server. Add your Fixie URL in Vercel → Environment Variables (Production), whitelist Fixie IP 52.5.155.132 in Flutterwave, then redeploy. Whitelisting alone does not work on Vercel Hobby.",
  );
}

function proxyDispatcher() {
  const url = flutterwaveProxyUrl();
  if (!url) return undefined;
  return new ProxyAgent(url);
}

/** Fetch that optionally exits through FLUTTERWAVE_HTTPS_PROXY / Fixie / QuotaGuard. */
export async function flutterwaveHttp(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const dispatcher = proxyDispatcher();
  if (!dispatcher) {
    return fetch(url, { ...init, cache: "no-store" });
  }

  const headers = new Headers(init?.headers);
  const res = await undiciFetch(url, {
    method: init?.method,
    headers,
    body: init?.body as string | Buffer | undefined,
    dispatcher,
  });

  return new Response(res.body as ReadableStream | null, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers as Headers,
  });
}
