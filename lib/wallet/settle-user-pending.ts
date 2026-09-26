import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, withdrawals } from "@/lib/db/schema";
import {
  lookupFlutterwaveTransfer,
  settlePayoutTransfer,
} from "@/lib/flutterwave/transfers";
import { pollJapOrderStatus } from "@/lib/jap";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import { settleStuckWithdrawals } from "@/lib/wallet/settle-withdrawals";

export const PENDING_SETTLE_AFTER_MS = 5 * 60 * 1000;

const OPEN_STATUSES = ["pending", "processing"] as const;
const TIMEOUT_REASON =
  "This withdrawal stayed pending for more than 5 minutes and was returned to your ORYNO wallet.";

type PendingRow = typeof transactions.$inferSelect;

async function forceReverseWithdrawal(row: PendingRow, reason: string) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const metaRef =
    typeof meta.reference === "string" ? meta.reference.trim() : "";

  const withdrawal =
    (await db.query.withdrawals.findFirst({
      where: eq(withdrawals.transactionId, row.id),
    })) ||
    (row.externalRef
      ? await db.query.withdrawals.findFirst({
          where: eq(withdrawals.providerRef, row.externalRef),
        })
      : null) ||
    (metaRef
      ? await db.query.withdrawals.findFirst({
          where: eq(withdrawals.providerRef, metaRef),
        })
      : null);

  const refundAmount = withdrawal
    ? Number(withdrawal.amount) + Number(withdrawal.fee || 0)
    : Number(row.amount);

  await refundFailedDebit({
    walletId: row.walletId,
    transactionId: row.id,
    amount: refundAmount > 0 ? refundAmount : Number(row.amount),
    reason,
    userId: row.userId,
  });

  if (withdrawal) {
    await db
      .update(withdrawals)
      .set({
        status: "failed",
        failureReason: reason,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id));
  }

  return "reversed" as const;
}

async function settlePendingWithdrawal(row: PendingRow) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const metaRef =
    typeof meta.reference === "string" ? meta.reference.trim() : "";
  const transferId =
    meta.flutterwaveTransferId ?? meta.transferCode ?? meta.transferId;

  const withdrawal =
    (await db.query.withdrawals.findFirst({
      where: eq(withdrawals.transactionId, row.id),
    })) ||
    (row.externalRef
      ? await db.query.withdrawals.findFirst({
          where: eq(withdrawals.providerRef, row.externalRef),
        })
      : null) ||
    (metaRef
      ? await db.query.withdrawals.findFirst({
          where: eq(withdrawals.providerRef, metaRef),
        })
      : null);

  const reference =
    withdrawal?.providerRef || row.externalRef || metaRef || "";

  try {
    if (reference || transferId) {
      const transfer = await lookupFlutterwaveTransfer(
        reference,
        transferId != null ? String(transferId) : null,
      );
      if (transfer?.status === "success") {
        if (reference) {
          await settlePayoutTransfer({
            reference,
            status: "success",
            transferCode: transfer.transferCode,
          });
        } else {
          await db
            .update(transactions)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(transactions.id, row.id));
          if (withdrawal) {
            await db
              .update(withdrawals)
              .set({
                status: "completed",
                processedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(withdrawals.id, withdrawal.id));
          }
        }
        return "completed" as const;
      }
      if (transfer?.status === "failed" || transfer?.status === "reversed") {
        if (reference) {
          await settlePayoutTransfer({
            reference,
            status: transfer.status,
            transferCode: transfer.transferCode,
            failureReason: transfer.failureReason || TIMEOUT_REASON,
          });
          return "reversed" as const;
        }
        return forceReverseWithdrawal(
          row,
          transfer.failureReason || TIMEOUT_REASON,
        );
      }
    }
  } catch (error) {
    console.error("[settle-pending-withdrawal-lookup]", row.id, error);
  }

  return forceReverseWithdrawal(row, TIMEOUT_REASON);
}

async function settlePendingService(row: PendingRow) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const provider = String(meta.provider || "");
  const requestId = String(row.externalRef || meta.requestId || "");

  if (provider === "vtpass" && requestId) {
    try {
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
        // Older than 5 minutes already — reverse instead of waiting forever.
      }
    } catch (error) {
      console.error("[settle-pending-service]", row.id, error);
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
  if (row.category === "withdraw") {
    return settlePendingWithdrawal(row);
  }
  // Numbers wait up to 1 hour for SMS — handled by expireStaleVirtualNumberPurchases.
  if (row.category === "virtual_number") {
    return "still_pending" as const;
  }
  if (row.category === "social") {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const japOrderId = String(meta.japOrderId || row.externalRef || "").trim();
    if (japOrderId) {
      try {
        const polled = await pollJapOrderStatus(japOrderId, row.userId);
        if (polled.orderStatus === "completed") return "completed" as const;
        if (
          polled.orderStatus === "failed" ||
          polled.orderStatus === "cancelled"
        ) {
          return "failed" as const;
        }
      } catch (error) {
        console.error("[settle-pending-social]", row.id, error);
      }
    }
    return "still_pending" as const;
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
  const withdrawalSettle = await settleStuckWithdrawals({
    userId: input.userId,
    limit: input.limit ?? 25,
  }).catch((error) => {
    console.error("[settle-user-withdrawals]", error);
    return { scanned: 0, results: [] as Array<{ id: string; action: string }> };
  });

  const cutoff = new Date(Date.now() - PENDING_SETTLE_AFTER_MS);
  const stuck = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, input.userId),
      inArray(transactions.status, [...OPEN_STATUSES]),
      // createdAt is NOT NULL; lte binds Date correctly (sql`...${Date}` does not with postgres.js).
      lte(transactions.createdAt, cutoff),
    ),
    limit: input.limit ?? 25,
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const results: Array<{ id: string; action: string }> = [
    ...withdrawalSettle.results.map((r) => ({
      id: r.id,
      action: `withdrawal:${r.action}`,
    })),
  ];
  let completed = withdrawalSettle.results.filter((r) => r.action === "completed")
    .length;
  let reversed = withdrawalSettle.results.filter((r) =>
    ["refunded", "already_refunded", "settled_from_provider", "marked_failed_no_tx"].includes(
      r.action,
    ),
  ).length;
  let failed = 0;

  for (const row of stuck) {
    try {
      // Skip if withdrawal settle already finalized this tx.
      const fresh = await db.query.transactions.findFirst({
        where: eq(transactions.id, row.id),
        columns: { status: true },
      });
      if (
        fresh &&
        !OPEN_STATUSES.includes(fresh.status as (typeof OPEN_STATUSES)[number])
      ) {
        results.push({ id: row.id, action: "already_settled" });
        continue;
      }

      const action = await settleOnePending(row);
      results.push({ id: row.id, action });
      if (action === "completed") completed += 1;
      else if (action === "reversed") reversed += 1;
      else if (action === "failed") failed += 1;
    } catch (error) {
      console.error("[settle-user-pending]", row.id, error);
      results.push({
        id: row.id,
        action: `error:${error instanceof Error ? error.message : "unknown"}`,
      });
    }
  }

  console.info("[settle-user-pending-summary]", {
    userId: input.userId,
    scanned: stuck.length,
    withdrawalsScanned: withdrawalSettle.scanned,
    completed,
    reversed,
    failed,
  });

  return {
    scanned: stuck.length + withdrawalSettle.scanned,
    completed,
    reversed,
    failed,
    results,
  };
}
