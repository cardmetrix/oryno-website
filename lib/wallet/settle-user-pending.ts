import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, withdrawals } from "@/lib/db/schema";
import {
  lookupFlutterwaveTransfer,
  settlePayoutTransfer,
} from "@/lib/flutterwave/transfers";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import { settleStuckWithdrawals } from "@/lib/wallet/settle-withdrawals";

export const PENDING_SETTLE_AFTER_MS = 5 * 60 * 1000;

const OPEN_STATUSES = ["pending", "processing"] as const;

type PendingRow = typeof transactions.$inferSelect;

async function settlePendingWithdrawal(row: PendingRow) {
  const withdrawal = await db.query.withdrawals.findFirst({
    where: row.externalRef
      ? eq(withdrawals.providerRef, row.externalRef)
      : eq(withdrawals.transactionId, row.id),
  });
  const reference = withdrawal?.providerRef || row.externalRef;
  if (reference) {
    const transfer = await lookupFlutterwaveTransfer(reference);
    if (transfer?.status === "success") {
      await settlePayoutTransfer({
        reference,
        status: "success",
        transferCode: transfer.transferCode,
      });
      return "completed" as const;
    }
    if (transfer?.status === "failed" || transfer?.status === "reversed") {
      await settlePayoutTransfer({
        reference,
        status: transfer.status,
        transferCode: transfer.transferCode,
        failureReason:
          transfer.failureReason ||
          "Withdrawal was not completed and was returned to your wallet.",
      });
      return "reversed" as const;
    }
  }

  await refundFailedDebit({
    walletId: row.walletId,
    transactionId: row.id,
    amount: Number(row.amount),
    reason:
      "This withdrawal stayed pending for more than 5 minutes and was returned to your ORYNO wallet.",
    userId: row.userId,
  });
  if (withdrawal) {
    await db
      .update(withdrawals)
      .set({
        status: "failed",
        failureReason:
          "Withdrawal timed out after 5 minutes and was returned to your ORYNO wallet.",
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id));
  }
  return "reversed" as const;
}

async function settlePendingService(row: PendingRow) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const provider = String(meta.provider || "");
  const requestId = String(row.externalRef || meta.requestId || "");

  if (provider === "vtpass" && requestId) {
    const { requeryPurchase, isVtpassSuccessCode, isVtpassPendingCode } =
      await import("@/lib/vtpass");
    const response = await requeryPurchase(requestId);
    const code = String(response.code || "");
    if (isVtpassSuccessCode(code)) {
      await db
        .update(transactions)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(transactions.id, row.id));
      return "completed" as const;
    }
    if (isVtpassPendingCode(code)) {
      return "still_pending" as const;
    }
  }

  await refundFailedDebit({
    walletId: row.walletId,
    transactionId: row.id,
    amount: Number(row.amount),
    reason:
      "This payment stayed pending for more than 5 minutes and was returned to your ORYNO wallet.",
    userId: row.userId,
  });
  return "reversed" as const;
}

async function settleOnePending(row: PendingRow) {
  if (row.category === "withdraw" || row.category === "payout") {
    return settlePendingWithdrawal(row);
  }
  if (row.type === "credit") {
    await db
      .update(transactions)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: {
          ...((row.metadata || {}) as Record<string, unknown>),
          timedOutAt: new Date().toISOString(),
          timeoutReason: "Pending credit expired after 5 minutes",
        },
      })
      .where(eq(transactions.id, row.id));
    return "failed" as const;
  }
  return settlePendingService(row);
}

/** Complete, fail, or reverse a user's pending transactions older than 5 minutes. */
export async function settleUserPendingTransactions(input: {
  userId: string;
  limit?: number;
}) {
  await settleStuckWithdrawals({
    userId: input.userId,
    limit: input.limit ?? 10,
  }).catch((error) => {
    console.error("[settle-user-withdrawals]", error);
  });

  const cutoff = new Date(Date.now() - PENDING_SETTLE_AFTER_MS);
  const stuck = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, input.userId),
      inArray(transactions.status, [...OPEN_STATUSES]),
      lte(transactions.createdAt, cutoff),
    ),
    limit: input.limit ?? 15,
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const results: Array<{ id: string; action: string }> = [];
  let completed = 0;
  let reversed = 0;
  let failed = 0;

  for (const row of stuck) {
    try {
      const action = await settleOnePending(row);
      results.push({ id: row.id, action });
      if (action === "completed") completed += 1;
      else if (action === "reversed") reversed += 1;
      else if (action === "failed") failed += 1;
    } catch (error) {
      console.error("[settle-user-pending]", row.id, error);
      results.push({ id: row.id, action: "error" });
    }
  }

  return {
    scanned: stuck.length,
    completed,
    reversed,
    failed,
    results,
  };
}
