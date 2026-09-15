import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { isHerosmsDemoMode, isHerosmsLive } from "@/lib/herosms/client";
import { isFivesimDemoMode, isFivesimLive } from "@/lib/fivesim/client";
import { isJapDemoMode, isJapLive } from "@/lib/jap/client";
import {
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";
import {
  hasReloadlyKeys,
  isReloadlyDemoMode,
  isReloadlySandbox,
} from "@/lib/reloadly/client";
import { isSogoDemoMode, isSogoSandbox, fetchSogoNgnBalance } from "@/lib/sogo/client";
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
    const sogoBalance = isSogoDemoMode() ? null : await fetchSogoNgnBalance();
    const providers = [
      {
        id: "sogo",
        name: "Sogo",
        type: "Gift card sell",
        country: "Nigeria",
        status: modeLabel({
          configured: !isSogoDemoMode(),
          demo: isSogoDemoMode(),
          sandbox: isSogoSandbox(),
        }),
        note:
          sogoBalance == null
            ? isSogoDemoMode()
              ? "Demo mode"
              : null
            : sogoBalance <= 0
              ? "Sogo NGN wallet is ₦0. Fund it at app.sogo.africa before gift-card sells will go through."
              : `Sogo NGN wallet ₦${sogoBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`,
      },
      {
        id: "vtpass",
        name: "VTpass",
        type: "Airtime / Data / Bills",
        country: "Nigeria + international",
        status: modeLabel({
          configured: !isVtpassDemoMode() || Boolean(process.env.VTPASS_API_KEY),
          demo: isVtpassDemoMode(),
          sandbox: isVtpassSandbox(),
        }),
      },
      {
        id: "fivesim",
        name: "5sim",
        type: "Virtual numbers",
        country: "Global",
        status: modeLabel({
          configured: isFivesimLive() || !isFivesimDemoMode(),
          demo: isFivesimDemoMode(),
        }),
      },
      {
        id: "herosms",
        name: "HeroSMS",
        type: "Emails (+ numbers fallback)",
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
        id: "flutterwave",
        name: "Flutterwave",
        type: "Wallet funding / withdrawals",
        country: "NG, GH, KE, ZA",
        status: modeLabel({
          configured: hasFlutterwaveKeys(),
          demo: isFlutterwaveDemoMode(),
        }),
      },
    ];

    return NextResponse.json({ ok: true, providers });
  });
}
