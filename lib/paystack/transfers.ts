import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, wallets, withdrawals } from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import { formatCountryMoney } from "@/lib/country";
import { convertNgnToLocal } from "@/lib/fx/rates";
import { getDisplayFx } from "@/lib/display-currency";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
  paystackFetch,
} from "@/lib/paystack/client";
import { ensureBankRecipient } from "@/lib/paystack/banks";
import type { BankAccountRow } from "@/lib/wallet";

type TransferData = {
  reference: string;
  transfer_code?: string;
  amount: number;
  currency: string;
  status: string;
  reason?: string | null;
};

export function nairaToKobo(amount: number) {
  return Math.round(amount * 100);
}

async function formatWithdrawalAmount(
  ledgerNgn: string | number,
  countryCode?: string | null,
) {
  const fx = await getDisplayFx(countryCode);
  const local =
    fx.to === "NGN"
      ? Number(ledgerNgn)
      : convertNgnToLocal(Number(ledgerNgn), fx.ngnToLocal);
  return formatCountryMoney(local, countryCode);
}

export async function initiatePaystackTransfer(input: {
  recipientCode: string;
  amount: number;
  currency?: string;
  reference: string;
  reason?: string;
}) {
  const currency = (input.currency ?? "NGN").toUpperCase();
  const amountKobo = nairaToKobo(input.amount);

  if (!hasPaystackKeys()) {
    return {
      reference: input.reference,
      transferCode: `TRF_DEMO_${input.reference}`,
      status: "success" as const,
      demoMode: true as const,
    };
  }

  const res = await paystackFetch<TransferData>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: amountKobo,
      recipient: input.recipientCode,
      reason: input.reason ?? "ORYNO wallet withdrawal",
      reference: input.reference,
      currency,
    }),
  });

  return {
    reference: res.data.reference || input.reference,
    transferCode: res.data.transfer_code ?? null,
    status: (res.data.status || "pending").toLowerCase(),
    demoMode: isPaystackDemoMode(),
  };
}

export async function sendPaystackWithdrawal(input: {
  bank: BankAccountRow;
  amount: number;
  currency: string;
  reference: string;
  countryCode?: string | null;
}) {
  const recipientCode = await ensureBankRecipient(
    input.bank,
    input.currency,
    input.countryCode,
  );

  try {
    const transfer = await initiatePaystackTransfer({
      recipientCode,
      amount: input.amount,
      currency: input.currency,
      reference: input.reference,
      reason: `ORYNO withdrawal to ${input.bank.bankName}`,
    });
    return { ok: true as const, transfer, recipientCode };
  } catch (error) {
    // Test keys often lack transfer balance — finish locally in demo mode.
    if (isPaystackDemoMode()) {
      return {
        ok: true as const,
        transfer: {
          reference: input.reference,
          transferCode: `TRF_DEMO_${input.reference}`,
          status: "success",
          demoMode: true as const,
        },
        recipientCode,
        simulated: true as const,
      };
    }
    throw error;
  }
}

export async function settlePaystackTransfer(input: {
  reference: string;
  status: "success" | "failed" | "reversed";
  transferCode?: string | null;
  failureReason?: string | null;
}) {
  const withdrawal = await db.query.withdrawals.findFirst({
    where: eq(withdrawals.providerRef, input.reference),
  });

  if (!withdrawal) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (
    withdrawal.status === "completed" ||
    withdrawal.status === "failed" ||
    withdrawal.status === "reversed"
  ) {
    return {
      ok: true as const,
      alreadySettled: true as const,
      status: withdrawal.status,
    };
  }

  if (input.status === "success") {
    await db.transaction(async (tx) => {
      await tx
        .update(withdrawals)
        .set({
          status: "completed",
          failureReason: null,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, withdrawal.id));

      if (withdrawal.transactionId) {
        const existing = await tx.query.transactions.findFirst({
          where: eq(transactions.id, withdrawal.transactionId),
        });
        await tx
          .update(transactions)
          .set({
            status: "completed",
            updatedAt: new Date(),
            metadata: {
              ...(existing?.metadata ?? {}),
              paystackTransferCode: input.transferCode ?? null,
              settledAt: new Date().toISOString(),
            },
          })
          .where(eq(transactions.id, withdrawal.transactionId));
      }
    });

    try {
      await createNotification({
        userId: withdrawal.userId,
        title: "Withdrawal completed",
        body: `${await formatWithdrawalAmount(withdrawal.amount, withdrawal.countryCode)} has been sent to your bank.`,
        type: "withdraw",
        metadata: {
          href: "/wallet",
          withdrawalId: withdrawal.id,
          reference: input.reference,
        },
      });
    } catch {
      // non-blocking
    }

    return { ok: true as const, status: "completed" as const };
  }

  // failed / reversed — credit wallet back
  await db.transaction(async (tx) => {
    const wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, withdrawal.walletId),
    });
    if (wallet) {
      const refund =
        Number(wallet.balance) +
        Number(withdrawal.amount) +
        Number(withdrawal.fee);
      await tx
        .update(wallets)
        .set({
          balance: refund.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(wallets.id, wallet.id));
    }

    await tx
      .update(withdrawals)
      .set({
        status: input.status === "reversed" ? "reversed" : "failed",
        failureReason: input.failureReason ?? "Transfer failed",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id));

    if (withdrawal.transactionId) {
      await tx
        .update(transactions)
        .set({
          status: input.status === "reversed" ? "reversed" : "failed",
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, withdrawal.transactionId));
    }
  });

  try {
    await createNotification({
      userId: withdrawal.userId,
      title: "Withdrawal failed",
      body:
        input.failureReason ||
        "Your withdrawal could not be completed. The amount was returned to your wallet.",
      type: "withdraw",
      metadata: {
        href: "/wallet",
        withdrawalId: withdrawal.id,
        reference: input.reference,
      },
    });
  } catch {
    // non-blocking
  }

  return {
    ok: true as const,
    status: input.status === "reversed" ? "reversed" : ("failed" as const),
  };
}
