import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, withdrawals } from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import { formatCountryMoney } from "@/lib/country";
import { convertNgnToLocal } from "@/lib/fx/rates";
import { getDisplayFx } from "@/lib/display-currency";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
  isPaymentSuccessful,
} from "@/lib/flutterwave/client";
import { assertFlutterwaveProxyConfigured } from "@/lib/flutterwave/http";
import { humanizeWalletRefundReason } from "@/lib/flutterwave/errors";
import type { BankAccountRow } from "@/lib/wallet";
import {
  refundFailedDebit,
  reverseCompletedDebit,
  ReverseFailedError,
} from "@/lib/wallet/ledger";

type TransferData = {
  id?: number;
  reference?: string;
  amount?: number;
  currency?: string;
  status?: string;
  complete_message?: string | null;
};

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

function mapTransferStatus(status?: string | null) {
  const value = (status || "").toLowerCase();
  if (isPaymentSuccessful(value) || value === "successful") {
    return "success" as const;
  }
  if (
    value === "failed" ||
    value === "failure" ||
    value.includes("fail") ||
    value === "cancelled" ||
    value === "canceled"
  ) {
    return "failed" as const;
  }
  if (value === "reversed") {
    return "reversed" as const;
  }
  return "pending" as const;
}

type TransferLookup = {
  status: "success" | "failed" | "reversed" | "pending";
  transferCode: string | null;
  failureReason: string | null;
  rawStatus: string | null;
};

function toTransferLookup(row: TransferData | null | undefined): TransferLookup | null {
  if (!row) return null;
  return {
    status: mapTransferStatus(row.status),
    transferCode: row.id != null ? String(row.id) : null,
    failureReason: row.complete_message ?? null,
    rawStatus: row.status ?? null,
  };
}

export async function lookupFlutterwaveTransfer(
  reference: string,
  transferId?: string | number | null,
) {
  if (!hasFlutterwaveKeys()) return null;

  if (transferId != null && String(transferId).trim()) {
    try {
      const res = await flutterwaveFetch<TransferData>(
        `/transfers/${encodeURIComponent(String(transferId).trim())}`,
      );
      const found = toTransferLookup(res.data);
      if (found) return found;
    } catch (error) {
      console.error("[flutterwave-transfer-lookup-id]", transferId, error);
    }
  }

  if (!reference.trim()) return null;

  try {
    const res = await flutterwaveFetch<TransferData | TransferData[]>(
      `/transfers?reference=${encodeURIComponent(reference.trim())}`,
    );
    const row = Array.isArray(res.data) ? res.data[0] : res.data;
    return toTransferLookup(row);
  } catch (error) {
    console.error("[flutterwave-transfer-lookup]", reference, error);
    return null;
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll Flutterwave until the bank transfer succeeds, fails, or times out. */
export async function confirmFlutterwaveTransfer(input: {
  reference: string;
  transferId?: string | number | null;
  attempts?: number;
  delayMs?: number;
}) {
  const attempts = input.attempts ?? 8;
  const delayMs = input.delayMs ?? 1500;
  let last: TransferLookup | null = null;

  for (let i = 0; i < attempts; i += 1) {
    last = await lookupFlutterwaveTransfer(input.reference, input.transferId);
    if (last?.status === "success" || last?.status === "failed" || last?.status === "reversed") {
      return last;
    }
    if (i < attempts - 1) await wait(delayMs);
  }

  return last;
}

export async function initiateFlutterwaveTransfer(input: {
  accountBank: string;
  accountNumber: string;
  beneficiaryName?: string;
  amount: number;
  currency?: string;
  reference: string;
  reason?: string;
  countryCode?: string | null;
}) {
  const currency = (input.currency ?? "NGN").toUpperCase();

  if (!hasFlutterwaveKeys()) {
    return {
      reference: input.reference,
      transferCode: `TRF_DEMO_${input.reference}`,
      status: "success" as const,
      demoMode: true as const,
    };
  }

  // Fail before creating a transfer if live mode has no Fixie/proxy.
  assertFlutterwaveProxyConfigured(isFlutterwaveDemoMode());

  const res = await flutterwaveFetch<TransferData>("/transfers", {
    method: "POST",
    body: JSON.stringify({
      account_bank: input.accountBank,
      account_number: input.accountNumber,
      amount: input.amount,
      narration: input.reason ?? "ORYNO wallet withdrawal",
      currency,
      reference: input.reference,
      beneficiary_name: input.beneficiaryName,
      debit_currency: currency,
    }),
  });

  const created = {
    reference: res.data.reference || input.reference,
    transferCode:
      res.data.id != null ? String(res.data.id) : res.data.reference || null,
    status: mapTransferStatus(res.data.status),
    demoMode: isFlutterwaveDemoMode(),
    failureReason: res.data.complete_message ?? null,
  };

  if (created.status === "failed" || created.status === "reversed") {
    throw new Error(
      created.failureReason || "Flutterwave could not send this withdrawal to the bank.",
    );
  }

  if (created.status === "success") {
    return created;
  }

  const confirmed = await confirmFlutterwaveTransfer({
    reference: created.reference,
    transferId: created.transferCode,
  });

  if (confirmed?.status === "failed" || confirmed?.status === "reversed") {
    throw new Error(
      confirmed.failureReason || "Flutterwave could not send this withdrawal to the bank.",
    );
  }

  return {
    ...created,
    status: confirmed?.status ?? "pending",
    transferCode: confirmed?.transferCode ?? created.transferCode,
    failureReason: confirmed?.failureReason ?? created.failureReason,
  };
}

export async function sendFlutterwaveWithdrawal(input: {
  bank: BankAccountRow;
  amount: number;
  currency: string;
  reference: string;
  countryCode?: string | null;
}) {
  if (!input.bank.bankCode) {
    throw new Error("Re-add this bank account so we can verify it.");
  }

  const transfer = await initiateFlutterwaveTransfer({
    accountBank: input.bank.bankCode,
    accountNumber: input.bank.accountNumber,
    beneficiaryName: input.bank.accountName,
    amount: input.amount,
    currency: input.currency,
    reference: input.reference,
    reason: `ORYNO withdrawal to ${input.bank.bankName}`,
    countryCode: input.countryCode,
  });

  return {
    ok: true as const,
    transfer,
    simulated: transfer.demoMode && transfer.status === "success",
  };
}

export async function settlePayoutTransfer(input: {
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

  if (withdrawal.status === "reversed") {
    return {
      ok: true as const,
      alreadySettled: true as const,
      status: withdrawal.status,
    };
  }

  if (withdrawal.status === "failed" && input.status !== "reversed") {
    return {
      ok: true as const,
      alreadySettled: true as const,
      status: withdrawal.status,
    };
  }

  const refundAmount =
    Number(withdrawal.amount) + Number(withdrawal.fee || 0);

  if (input.status === "success") {
    if (withdrawal.status === "completed") {
      return {
        ok: true as const,
        alreadySettled: true as const,
        status: "completed" as const,
      };
    }

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
              flutterwaveTransferId: input.transferCode ?? null,
              settledAt: new Date().toISOString(),
            },
          })
          .where(eq(transactions.id, withdrawal.transactionId));
      }
    });

    try {
      const amountFormatted = await formatWithdrawalAmount(
        withdrawal.amount,
        withdrawal.countryCode,
      );
      const reference =
        input.reference.trim() ||
        withdrawal.providerRef?.trim() ||
        withdrawal.id;
      await createNotification({
        userId: withdrawal.userId,
        title: "Withdrawal Successful 🎉",
        body: `${amountFormatted} has been sent to your bank.`,
        type: "withdraw",
        metadata: {
          href: "/wallet",
          withdrawalId: withdrawal.id,
          amountFormatted,
          reference,
          status: "completed",
        },
      });
    } catch {
      // non-blocking
    }

    return { ok: true as const, status: "completed" as const };
  }

  const nextStatus = input.status === "reversed" ? "reversed" : "failed";
  const reason = humanizeWalletRefundReason(
    input.failureReason ||
      (input.status === "reversed"
        ? "This withdrawal was reversed"
        : "Transfer failed"),
  );

  try {
    if (withdrawal.transactionId) {
      const ledgerInput = {
        walletId: withdrawal.walletId,
        transactionId: withdrawal.transactionId,
        amount: refundAmount,
        reason,
        userId: withdrawal.userId,
      };
      if (withdrawal.status === "completed" || input.status === "reversed") {
        await reverseCompletedDebit(ledgerInput);
      } else {
        await refundFailedDebit(ledgerInput);
      }
    }
  } catch (error) {
    console.error("[flutterwave-transfer-reverse]", error);
    if (error instanceof ReverseFailedError) {
      await db
        .update(withdrawals)
        .set({
          failureReason: error.message,
          updatedAt: new Date(),
        })
        .where(eq(withdrawals.id, withdrawal.id));
      throw error;
    }
    throw error;
  }

  await db
    .update(withdrawals)
    .set({
      status: nextStatus,
      failureReason: reason,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawal.id));

  try {
    await createNotification({
      userId: withdrawal.userId,
      title:
        nextStatus === "reversed"
          ? "Withdrawal reversed"
          : "Withdrawal failed",
      body:
        nextStatus === "reversed"
          ? `${await formatWithdrawalAmount(withdrawal.amount, withdrawal.countryCode)} was reversed and returned to your wallet.`
          : reason + " The amount was returned to your wallet.",
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
    status: nextStatus,
  };
}

export const settlePaystackTransfer = settlePayoutTransfer;
export const sendPaystackWithdrawal = sendFlutterwaveWithdrawal;
