import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { withdrawals } from "@/lib/db/schema";
import {
  lookupFlutterwaveTransfer,
  settlePayoutTransfer,
} from "@/lib/flutterwave/transfers";
import { createNotification } from "@/lib/notifications-service";
import { formatCountryMoney } from "@/lib/country";
import { convertNgnToLocal } from "@/lib/fx/rates";
import { getDisplayFx } from "@/lib/display-currency";
import { refundFailedDebit } from "@/lib/wallet/ledger";

export const WITHDRAWAL_TIMEOUT_MS = 30 * 60 * 1000;

const TIMEOUT_REASON =
  "Withdrawal timed out after 30 minutes and was returned to your ORYNO wallet.";

const STUCK_WITHDRAWAL_STATUSES = [
  "pending_verification",
  "processing",
  "sent_to_provider",
] as const;

type StuckWithdrawal = typeof withdrawals.$inferSelect;

async function formatWithdrawalTotal(
  withdrawal: StuckWithdrawal,
) {
  const totalNgn = Number(withdrawal.amount) + Number(withdrawal.fee || 0);
  const fx = await getDisplayFx(withdrawal.countryCode);
  const local =
    fx.to === "NGN"
      ? totalNgn
      : convertNgnToLocal(totalNgn, fx.ngnToLocal);
  return formatCountryMoney(local, withdrawal.countryCode);
}

async function reverseTimedOutWithdrawal(withdrawal: StuckWithdrawal) {
  if (!withdrawal.transactionId) {
    await db
      .update(withdrawals)
      .set({
        status: "failed",
        failureReason: TIMEOUT_REASON,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, withdrawal.id));
    return { action: "marked_failed_no_tx" as const };
  }

  const refundAmount = Number(withdrawal.amount) + Number(withdrawal.fee || 0);
  const refund = await refundFailedDebit({
    walletId: withdrawal.walletId,
    transactionId: withdrawal.transactionId,
    amount: refundAmount,
    reason: TIMEOUT_REASON,
    userId: withdrawal.userId,
  });

  await db
    .update(withdrawals)
    .set({
      status: "failed",
      failureReason: TIMEOUT_REASON,
      processedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(withdrawals.id, withdrawal.id));

  if (!refund.already) {
    try {
      const amountFormatted = await formatWithdrawalTotal(withdrawal);
      await createNotification({
        userId: withdrawal.userId,
        title: "Withdrawal returned to wallet",
        body: `${amountFormatted} was not sent to your bank in time and is back in your ORYNO wallet.`,
        type: "withdraw",
        metadata: {
          href: "/wallet",
          withdrawalId: withdrawal.id,
          reference: withdrawal.providerRef,
          timedOut: true,
        },
      });
    } catch {
      // non-blocking
    }
  }

  return {
    action: refund.already ? ("already_refunded" as const) : ("refunded" as const),
  };
}

async function settleOneStuckWithdrawal(withdrawal: StuckWithdrawal) {
  const reference = withdrawal.providerRef?.trim();
  if (reference) {
    const transfer = await lookupFlutterwaveTransfer(reference);
    if (transfer?.status === "success") {
      await settlePayoutTransfer({
        reference,
        status: "success",
        transferCode: transfer.transferCode,
      });
      return { action: "completed" as const };
    }
    if (transfer?.status === "failed" || transfer?.status === "reversed") {
      await settlePayoutTransfer({
        reference,
        status: transfer.status,
        transferCode: transfer.transferCode,
        failureReason: transfer.failureReason || TIMEOUT_REASON,
      });
      return { action: "settled_from_provider" as const };
    }
  }

  return reverseTimedOutWithdrawal(withdrawal);
}

/** Return stuck withdrawals to the ORYNO wallet after 30 minutes. */
export async function settleStuckWithdrawals(input?: {
  userId?: string;
  limit?: number;
}) {
  const cutoff = new Date(Date.now() - WITHDRAWAL_TIMEOUT_MS);
  const stuck = await db.query.withdrawals.findMany({
    where: and(
      inArray(withdrawals.status, [...STUCK_WITHDRAWAL_STATUSES]),
      lte(withdrawals.createdAt, cutoff),
      input?.userId ? eq(withdrawals.userId, input.userId) : undefined,
    ),
    limit: input?.limit ?? 25,
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const results: Array<{ id: string; action: string }> = [];
  for (const withdrawal of stuck) {
    try {
      const outcome = await settleOneStuckWithdrawal(withdrawal);
      results.push({ id: withdrawal.id, action: outcome.action });
    } catch (error) {
      console.error("[settle-stuck-withdrawal]", withdrawal.id, error);
      results.push({ id: withdrawal.id, action: "error" });
    }
  }

  return { scanned: stuck.length, results };
}
