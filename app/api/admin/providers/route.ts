import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { isFivesimDemoMode, isFivesimLive } from "@/lib/fivesim/client";
import { isJapDemoMode, isJapLive } from "@/lib/jap/client";
import {
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";
import {
  fetchReloadlyBalance,
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
    let reloadlyBalance: { balance: number; currencyCode: string } | null = null;
    let reloadlyBalanceError: string | null = null;
    if (hasReloadlyKeys() && !isReloadlyDemoMode()) {
      try {
        reloadlyBalance = await fetchReloadlyBalance();
      } catch (e) {
        reloadlyBalanceError =
          e instanceof Error ? e.message : "Failed to load Reloadly balance";
      }
    }
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
        note: reloadlyBalanceError
          ? `Balance check failed: ${reloadlyBalanceError}`
          : reloadlyBalance == null
            ? isReloadlyDemoMode()
              ? "Demo mode"
              : null
            : reloadlyBalance.balance <= 0
              ? `Reloadly Gift Cards wallet is ${reloadlyBalance.currencyCode} 0. Fund it in the Reloadly dashboard before buys will succeed.`
              : `Reloadly Gift Cards wallet ${reloadlyBalance.currencyCode} ${reloadlyBalance.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
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
