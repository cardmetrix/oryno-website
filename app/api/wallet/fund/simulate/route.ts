import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { isPaystackDemoMode } from "@/lib/paystack/client";
import {
  creditWalletFromDeposit,
  getOrCreateDepositAccount,
} from "@/lib/paystack/deposit-accounts";

export const runtime = "nodejs";

/**
 * Demo/test helper: simulates a Paystack bank-transfer deposit into the user's
 * dedicated virtual account without a real bank transfer.
 */
export async function POST(req: Request) {
  try {
    if (!isPaystackDemoMode()) {
      return NextResponse.json(
        { error: "Simulate deposit is only available in Paystack test/demo mode" },
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

    const naira = Number(body.amount);
    if (!Number.isFinite(naira) || naira <= 0) {
      return NextResponse.json(
        { error: "Enter a valid amount greater than zero." },
        { status: 400 },
      );
    }

    const account = await getOrCreateDepositAccount(user.id);
    const amountKobo = Math.round(naira * 100);
    const reference = `DEMO_DVA_${Date.now().toString(36).toUpperCase()}`;

    const result = await creditWalletFromDeposit({
      userId: user.id,
      amountKobo,
      currency: account.currency || "NGN",
      reference,
      channel: "dedicated_nuban",
      paidAt: new Date().toISOString(),
      raw: {
        demo: true,
        accountNumber: account.accountNumber,
        bankName: account.bankName,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Demo deposit credited",
      account,
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
