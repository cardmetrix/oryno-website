import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { createNotification } from "@/lib/notifications-service";
import { notifyTransactionPinChanged } from "@/lib/notify/pin-events";
import {
  getTransactionPinStatus,
  requireTransactionPin,
  setTransactionPin,
  TransactionPinError,
} from "@/lib/security/transaction-pin";
import { formatCountryMoney } from "@/lib/country";
import { getDisplayFx } from "@/lib/display-currency";
import { toWalletSummary, withdrawWallet } from "@/lib/wallet";
import {
  actionLockHttpStatus,
  withUserActionLock,
} from "@/lib/wallet/action-lock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      amount?: string | number;
      bankAccountId?: string;
      pin?: string;
      /** When user has no PIN yet, set it in the same request before withdraw. */
      newPin?: string;
    };

    if (!body.bankAccountId) {
      return NextResponse.json(
        { error: "Select a bank account" },
        { status: 400 },
      );
    }

    const status = await getTransactionPinStatus(user.id);

    if (!status.hasPin) {
      if (!body.newPin) {
        return NextResponse.json(
          {
            error: "Create a transaction PIN to withdraw.",
            code: "pin_required",
            hasPin: false,
          },
          { status: 400 },
        );
      }
      try {
        const result = await setTransactionPin({
          userId: user.id,
          pin: body.newPin,
        });
        try {
          await notifyTransactionPinChanged({
            userId: user.id,
            fullName: user.fullName,
            created: result.created,
          });
        } catch (notifyError) {
          console.error("[wallet-withdraw-pin-notify]", notifyError);
        }
      } catch (error) {
        if (error instanceof TransactionPinError) {
          return NextResponse.json(
            { error: error.message, code: error.code, hasPin: false },
            { status: error.status },
          );
        }
        throw error;
      }
    }

    try {
      await requireTransactionPin(user.id, body.pin || body.newPin);
    } catch (error) {
      if (error instanceof TransactionPinError) {
        return NextResponse.json(
          {
            error: error.message,
            code: error.code,
            hasPin: true,
          },
          { status: error.status },
        );
      }
      throw error;
    }

    const { settleStuckWithdrawals } = await import(
      "@/lib/wallet/settle-withdrawals"
    );
    await settleStuckWithdrawals({ userId: user.id, limit: 5 });

    const { getWithdrawFeeNgn } = await import("@/lib/company/charges");
    const withdrawFee = await getWithdrawFeeNgn();

    const result = await withUserActionLock(user.id, () =>
      withdrawWallet({
        userId: user.id,
        amount: body.amount ?? 0,
        bankAccountId: body.bankAccountId!,
        countryCode: user.countryCode ?? "NG",
        fee: withdrawFee,
      }),
    );

    const amountFormatted = formatCountryMoney(
      result.localAmount,
      result.countryCode,
    );
    const fx = await getDisplayFx(user.countryCode);

    const pending = Boolean(result.pending);
    try {
      const reference =
        result.withdrawal.providerRef?.trim() ||
        result.transaction.externalRef?.trim() ||
        result.transaction.id;
      await createNotification({
        userId: user.id,
        title: pending ? "Withdrawal processing" : "Withdrawal Successful 🎉",
        body: pending
          ? `${amountFormatted} is on the way to ${result.bank.bankName}. Ref ${reference}`
          : `${amountFormatted} sent to ${result.bank.bankName}. Ref ${reference}`,
        type: "withdraw",
        metadata: {
          href: "/wallet",
          withdrawalId: result.withdrawal.id,
          transactionId: result.transaction.id,
          amountFormatted,
          reference,
          status: pending ? "processing" : "completed",
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
      wallet: toWalletSummary(result.wallet, fx),
      withdrawalId: result.withdrawal.id,
      transactionId: result.transaction.id,
      amountFormatted,
      reference: result.withdrawal.providerRef,
      fee: withdrawFee,
      bank: {
        bankName: result.bank.bankName,
        accountNumber: result.bank.accountNumber,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to withdraw";
    console.error("[wallet-withdraw]", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return NextResponse.json(
      { error: message },
      { status: actionLockHttpStatus(error) || 400 },
    );
  }
}
