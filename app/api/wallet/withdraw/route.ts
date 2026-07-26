import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import {
  currencyForCountry,
  toWalletSummary,
  withdrawWallet,
} from "@/lib/wallet";

export const runtime = "nodejs";

/** Flat demo fee — replace with gateway pricing later */
const WITHDRAW_FEE = 0;

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      amount?: string | number;
      bankAccountId?: string;
    };

    if (!body.bankAccountId) {
      return NextResponse.json(
        { error: "Select a bank account" },
        { status: 400 },
      );
    }

    const result = await withdrawWallet({
      userId: user.id,
      amount: body.amount ?? 0,
      bankAccountId: body.bankAccountId,
      countryCode: user.countryCode ?? "NG",
      currency: currencyForCountry(user.countryCode),
      fee: WITHDRAW_FEE,
    });

    const amountFormatted = formatMoney(
      result.withdrawal.amount,
      result.withdrawal.currency,
    );

    const pending = Boolean(result.pending);
    try {
      await createNotification({
        userId: user.id,
        title: pending ? "Withdrawal processing" : "Withdrawal completed",
        body: pending
          ? `${amountFormatted} is on the way to ${result.bank.bankName}. Ref ${result.withdrawal.providerRef ?? "—"}`
          : `${amountFormatted} sent to ${result.bank.bankName}. Ref ${result.withdrawal.providerRef ?? "—"}`,
        type: "withdraw",
        metadata: {
          href: "/wallet",
          withdrawalId: result.withdrawal.id,
          transactionId: result.transaction.id,
        },
      });
    } catch (notifyError) {
      console.error("[wallet-withdraw-notify]", notifyError);
    }

    return NextResponse.json({
      ok: true,
      message: pending ? "Withdrawal processing" : "Withdrawal completed",
      pending,
      status: result.withdrawal.status,
      wallet: toWalletSummary(result.wallet),
      withdrawalId: result.withdrawal.id,
      transactionId: result.transaction.id,
      amountFormatted,
      reference: result.withdrawal.providerRef,
      bank: {
        bankName: result.bank.bankName,
        accountNumber: result.bank.accountNumber,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to withdraw";
    console.error("[wallet-withdraw]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
