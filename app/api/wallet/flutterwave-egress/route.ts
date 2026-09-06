import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { isFlutterwaveDemoMode } from "@/lib/flutterwave/client";
import { getServerEgressIp } from "@/lib/flutterwave/egress-ip";
import {
  allowFlutterwaveDirect,
  DEFAULT_FIXIE_OUTBOUND_IP,
  flutterwavePinnedProxyIp,
  flutterwaveProxyHost,
  hasFlutterwaveProxy,
} from "@/lib/flutterwave/http";

export const runtime = "nodejs";

/** Shows whether Fixie/proxy is configured and which IP Flutterwave will see. */
export async function GET() {
  const user = await ensureAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const proxyConfigured = hasFlutterwaveProxy();
  const proxyHost = flutterwaveProxyHost();
  const demoMode = isFlutterwaveDemoMode();
  const allowDirect = allowFlutterwaveDirect();
  const pinnedIp = flutterwavePinnedProxyIp() || DEFAULT_FIXIE_OUTBOUND_IP;
  let egressIp: string | null = null;
  let egressError: string | null = null;

  try {
    egressIp = await getServerEgressIp();
  } catch (error) {
    egressError = error instanceof Error ? error.message : "Could not resolve egress IP";
  }

  const ready =
    demoMode ||
    allowDirect ||
    (proxyConfigured && Boolean(egressIp));

  return NextResponse.json({
    ok: true,
    ready,
    proxyConfigured,
    proxyHost,
    pinnedIp,
    demoMode,
    allowDirect,
    egressIp,
    expectedEgressIp: pinnedIp,
    egressError,
    vercelHint:
      "If proxyConfigured is false here, the env var is missing on this deployed environment even if it exists in local .env.",
    flutterwaveHint:
      `Traffic is pinned to ${pinnedIp}. Whitelist that exact IP in Flutterwave.`,
    message: ready
      ? `Flutterwave outbound path looks ready${egressIp ? ` (egress ${egressIp})` : ""}.`
      : !proxyConfigured
        ? "FLUTTERWAVE_HTTPS_PROXY / FIXIE_URL is not set on this deployed server. Add it in Vercel Production env and redeploy."
        : egressError ||
          "Could not confirm proxy egress IP yet. Check Fixie credentials and Flutterwave whitelist.",
  });
}
