import { ProxyAgent, fetch as undiciFetch } from "undici";

/** Known Fixie egress IP that Flutterwave should whitelist. */
export const DEFAULT_FIXIE_OUTBOUND_IP = "52.5.155.132";

function rawProxyUrl() {
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

/** Pin Fixie traffic to one IP so Flutterwave whitelist cannot flake across the pair. */
export function flutterwavePinnedProxyIp() {
  const explicit = (
    process.env.FLUTTERWAVE_PROXY_IP ||
    process.env.FIXIE_OUTBOUND_IP ||
    process.env.FLUTTERWAVE_EXPECTED_EGRESS_IP ||
    ""
  ).trim();
  if (explicit) return explicit;

  const raw = rawProxyUrl().toLowerCase();
  // Fixie load-balances across 2 IPs unless we address one IP directly.
  if (raw.includes("usefixie.com") || raw.includes("fixie:")) {
    return DEFAULT_FIXIE_OUTBOUND_IP;
  }
  return "";
}

/** Optional static-IP proxy so Flutterwave can whitelist a fixed egress on Vercel Hobby. */
export function flutterwaveProxyUrl() {
  const raw = rawProxyUrl();
  if (!raw) return "";

  const pinnedIp = flutterwavePinnedProxyIp();
  if (!pinnedIp) return raw;

  try {
    const parsed = new URL(raw);
    // Already pinned to an IP host.
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname)) return raw;
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
    const detail = error instanceof Error ? error.message : String(error);
    const cause =
      error instanceof Error && error.cause instanceof Error
        ? error.cause.message
        : "";
    const combined = `${detail} ${cause}`.trim();
    // Fixie returns HTTP 407 with "Monthly request quota exceeded" when the plan is exhausted.
    if (
      /407/.test(combined) ||
      /proxy authentication required/i.test(combined) ||
      /quota exceeded/i.test(combined)
    ) {
      throw new Error(
        `Flutterwave proxy request failed${host ? ` via ${host}` : ""}: Monthly request quota exceeded (HTTP 407). Upgrade Fixie or wait until the quota resets.`,
      );
    }
    throw new Error(
      `Flutterwave proxy request failed${host ? ` via ${host}` : ""}: ${detail}`,
    );
  }
}
