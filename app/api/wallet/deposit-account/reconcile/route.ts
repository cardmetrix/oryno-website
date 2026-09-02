import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { reconcileUserDeposits } from "@/lib/flutterwave/reconcile-deposits";
import { ensurePrimaryWallet, toWalletSummary } from "@/lib/wallet";

export const runtime = "nodejs";

/** Check Flutterwave for successful bank transfers that were not yet credited. */
export async function POST() {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await reconcileUserDeposits(user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, credited: 0, checked: 0 },
        { status: 400 },
      );
    }

    const wallet = await ensurePrimaryWallet(user.id, "NGN");
    const { getDisplayFx } = await import("@/lib/display-currency");
    const fx = await getDisplayFx(user.countryCode);

    return NextResponse.json({
      ok: true,
      credited: result.credited,
      checked: result.checked,
      wallet: toWalletSummary(wallet, fx),
      message:
        result.credited > 0
          ? `${result.credited} deposit${result.credited === 1 ? "" : "s"} credited to your wallet.`
          : result.checked > 0
            ? "Payments were already credited to your wallet."
            : "No new bank transfers found yet. Transfers can take a few minutes.",
    });
  } catch (error) {
    console.error("[deposit-reconcile]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not check for new deposits",
      },
      { status: 500 },
    );
  }
}
