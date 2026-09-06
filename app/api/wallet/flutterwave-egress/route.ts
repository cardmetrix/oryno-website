import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { isFlutterwaveDemoMode } from "@/lib/flutterwave/client";
import { getServerEgressIp } from "@/lib/flutterwave/egress-ip";
import {
  allowFlutterwaveDirect,
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
  const demoMode = isFlutterwaveDemoMode();
  const allowDirect = allowFlutterwaveDirect();
  let egressIp: string | null = null;
  let egressError: string | null = null;

  try {
    egressIp = await getServerEgressIp();
  } catch (error) {
    egressError = error instanceof Error ? error.message : "Could not resolve egress IP";
  }

  const expected =
    (process.env.FLUTTERWAVE_EXPECTED_EGRESS_IP || "52.5.155.132").trim();
  const ready =
    demoMode ||
    allowDirect ||
    (proxyConfigured && Boolean(egressIp) && (!expected || egressIp === expected));

  return NextResponse.json({
    ok: true,
    ready,
    proxyConfigured,
    demoMode,
    allowDirect,
    egressIp,
    expectedEgressIp: expected,
    egressError,
    message: ready
      ? "Flutterwave outbound path looks ready."
      : !proxyConfigured
        ? "FLUTTERWAVE_HTTPS_PROXY is not set on this server. Add Fixie in Vercel Environment Variables and redeploy."
        : egressIp && egressIp !== expected
          ? `Proxy is active but egress IP is ${egressIp}. Whitelist that IP in Flutterwave (expected ${expected}).`
          : "Could not confirm proxy egress IP yet.",
  });
}
