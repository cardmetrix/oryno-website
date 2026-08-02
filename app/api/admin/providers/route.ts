import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { isHerosmsDemoMode, isHerosmsLive } from "@/lib/herosms/client";
import { isJapDemoMode, isJapLive } from "@/lib/jap/client";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
} from "@/lib/paystack/client";
import {
  hasReloadlyKeys,
  isReloadlyDemoMode,
  isReloadlySandbox,
} from "@/lib/reloadly/client";
import { isSogoDemoMode, isSogoSandbox } from "@/lib/sogo/client";
import { isVtpassDemoMode, isVtpassSandbox } from "@/lib/vtpass/client";

export const runtime = "nodejs";

function modeLabel(input: {
  configured: boolean;
  demo: boolean;
  sandbox?: boolean;
}) {
  if (!input.configured || input.demo) return "Demo";
  if (input.sandbox) return "Sandbox";
  return "Live";
}

export async function GET() {
  return withAdminApi(async () => {
    const providers = [
      {
        id: "vtpass",
        name: "VTpass",
        type: "Airtime / Data / Bills",
        country: "Nigeria",
        status: modeLabel({
          configured: !isVtpassDemoMode() || Boolean(process.env.VTPASS_API_KEY),
          demo: isVtpassDemoMode(),
          sandbox: isVtpassSandbox(),
        }),
      },
      {
        id: "herosms",
        name: "HeroSMS",
        type: "Virtual numbers / Emails",
        country: "Global",
        status: modeLabel({
          configured: isHerosmsLive() || !isHerosmsDemoMode(),
          demo: isHerosmsDemoMode(),
        }),
      },
      {
        id: "jap",
        name: "JustAnotherPanel",
        type: "Social boosting",
        country: "Global",
        status: modeLabel({
          configured: isJapLive() || !isJapDemoMode(),
          demo: isJapDemoMode(),
        }),
      },
      {
        id: "sogo",
        name: "Sogo",
        type: "Gift card sell",
        country: "Global",
        status: modeLabel({
          configured: !isSogoDemoMode(),
          demo: isSogoDemoMode(),
          sandbox: isSogoSandbox(),
        }),
      },
      {
        id: "reloadly",
        name: "Reloadly",
        type: "Gift card buy",
        country: "Global",
        status: modeLabel({
          configured: hasReloadlyKeys() && !isReloadlyDemoMode(),
          demo: isReloadlyDemoMode(),
          sandbox: isReloadlySandbox(),
        }),
      },
      {
        id: "paystack",
        name: "Paystack",
        type: "Wallet funding / withdrawals",
        country: "Nigeria",
        status: modeLabel({
          configured: hasPaystackKeys(),
          demo: isPaystackDemoMode(),
        }),
      },
    ];

    return NextResponse.json({ ok: true, providers });
  });
}
