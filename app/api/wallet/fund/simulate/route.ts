import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry } from "@/lib/country";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { isFlutterwaveDemoMode } from "@/lib/flutterwave/client";
import { creditWalletFromDeposit } from "@/lib/flutterwave/deposit-accounts";

export const runtime = "nodejs";

/**
 * Demo/test helper: simulates a Flutterwave bank-transfer deposit into the
 * user's dedicated virtual account without a real bank transfer.
 */
export async function POST(req: Request) {
  try {
    if (!isFlutterwaveDemoMode()) {
      return NextResponse.json(
        { error: "Simulate deposit is only available in test/demo mode" },
        { status: 403 },
      );
    }

    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      amount?: string | number;
    };

    const localAmount = Number(body.amount);
    if (!Number.isFinite(localAmount) || localAmount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid amount greater than zero." },
        { status: 400 },
      );
    }

    const currency = currencyForCountry(user.countryCode);
    const amountKobo = Math.round(localAmount * 100);
    const reference = `DEMO_FND_${Date.now().toString(36).toUpperCase()}`;

    const result = await creditWalletFromDeposit({
      userId: user.id,
      amountKobo,
      currency,
      reference,
      channel: "flutterwave_demo",
      paidAt: new Date().toISOString(),
      raw: {
        demo: true,
        countryCode: user.countryCode,
        currency,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Demo deposit credited",
      ...result,
    });
  } catch (error) {
    console.error("[fund-simulate]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to simulate deposit",
      },
      { status: 400 },
    );
  }
}
