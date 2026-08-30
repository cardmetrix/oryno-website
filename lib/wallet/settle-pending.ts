import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { refundFailedDebit } from "@/lib/wallet/ledger";

const STUCK_AFTER_MS = 3 * 60_000;
const TIMEOUT_REFUND_MS = 30 * 60_000;

export async function settleStuckDebits(limit = 40) {
  const cutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const stuck = await db.query.transactions.findMany({
    where: and(
      eq(transactions.type, "debit"),
      inArray(transactions.status, ["pending", "processing"]),
      lte(transactions.updatedAt, cutoff),
    ),
    limit,
    orderBy: (t, { asc }) => [asc(t.updatedAt)],
  });

  const results: Array<{ id: string; action: string }> = [];

  for (const row of stuck) {
    const age = Date.now() - new Date(row.updatedAt).getTime();
    const meta = (row.metadata || {}) as Record<string, unknown>;
    const provider = String(meta.provider || "");
    const requestId = String(row.externalRef || meta.requestId || "");

    try {
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
          results.push({ id: row.id, action: "completed" });
          continue;
        }
        if (isVtpassPendingCode(code) && age < TIMEOUT_REFUND_MS) {
          results.push({ id: row.id, action: "still_pending" });
          continue;
        }
      }

      if (age < TIMEOUT_REFUND_MS && provider !== "vtpass") {
        results.push({ id: row.id, action: "waiting_webhook" });
        continue;
      }

      await refundFailedDebit({
        walletId: row.walletId,
        transactionId: row.id,
        amount: Number(row.amount),
        reason: "Payment timed out and was reversed",
        userId: row.userId,
      });
      results.push({ id: row.id, action: "refunded" });
    } catch (error) {
      console.error("[settle-stuck]", row.id, error);
      results.push({ id: row.id, action: "error" });
    }
  }

  return { scanned: stuck.length, results };
}
