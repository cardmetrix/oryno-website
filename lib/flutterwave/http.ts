import { ProxyAgent, fetch as undiciFetch } from "undici";

/** Optional static-IP proxy so Flutterwave can whitelist a fixed egress on Vercel Hobby. */
export function flutterwaveProxyUrl() {
  const raw = (
    process.env.FLUTTERWAVE_HTTPS_PROXY ||
    process.env.FLUTTERWAVE_PROXY_URL ||
    process.env.FIXIE_URL ||
    process.env.QUOTAGUARDSTATIC_URL ||
    process.env.HTTPS_PROXY ||
    process.env.HTTP_PROXY ||
    ""
  ).trim();

  if (!raw) return "";

  // Optional: pin to one Fixie IP so Flutterwave only needs one whitelist entry.
  // Example: FLUTTERWAVE_PROXY_IP=52.5.155.132
  const pinnedIp = (
    process.env.FLUTTERWAVE_PROXY_IP ||
    process.env.FIXIE_OUTBOUND_IP ||
    ""
  ).trim();
  if (!pinnedIp) return raw;

  try {
    const parsed = new URL(raw);
    parsed.hostname = pinnedIp;
    if (!parsed.port) parsed.port = "80";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function hasFlutterwaveProxy() {
  return Boolean(flutterwaveProxyUrl());
}

export function allowFlutterwaveDirect() {
  const value = (process.env.FLUTTERWAVE_ALLOW_DIRECT || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function flutterwaveProxyHost() {
  try {
    const url = flutterwaveProxyUrl();
    if (!url) return null;
    return new URL(url).host;
  } catch {
    return null;
  }
}

/**
 * Live Flutterwave payouts on Vercel Hobby must use Fixie/QuotaGuard.
 * Without this, Flutterwave sees a random Vercel IP and blocks transfers.
 */
export function assertFlutterwaveProxyConfigured(isDemoMode: boolean) {
  if (isDemoMode || allowFlutterwaveDirect()) return;
  if (hasFlutterwaveProxy()) return;
  throw new Error(
    "FLUTTERWAVE_HTTPS_PROXY / FIXIE_URL is missing on this deployed server. Having it only in local .env is not enough — add it in Vercel → Settings → Environment Variables for Production, whitelist BOTH Fixie outbound IPs (or pin one with FLUTTERWAVE_PROXY_IP), then Redeploy.",
  );
}

function proxyDispatcher() {
  const url = flutterwaveProxyUrl();
  if (!url) return undefined;
  // undici ProxyAgent supports HTTP CONNECT for HTTPS targets (Flutterwave).
  return new ProxyAgent({
    uri: url,
    requestTls: {
      // Keep TLS end-to-end to Flutterwave; Fixie only tunnels CONNECT.
      rejectUnauthorized: true,
    },
  });
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
  try {
    const res = await undiciFetch(url, {
      method: init?.method || "GET",
      headers,
      body: init?.body as string | Buffer | undefined,
      dispatcher,
    });

    // Buffer body so Next.js / web Response consumers can reliably call .json().
    const buffer = Buffer.from(await res.arrayBuffer());
    return new Response(buffer, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers as Headers,
    });
  } catch (error) {
    const host = flutterwaveProxyHost();
    throw new Error(
      `Flutterwave proxy request failed${host ? ` via ${host}` : ""}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
