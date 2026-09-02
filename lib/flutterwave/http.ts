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
