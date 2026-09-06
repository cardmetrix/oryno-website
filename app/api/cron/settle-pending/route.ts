import { NextResponse } from "next/server";
import { and, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { settleStuckDebits } from "@/lib/wallet/settle-pending";
import { settleStuckWithdrawals } from "@/lib/wallet/settle-withdrawals";
import {
  PENDING_SETTLE_AFTER_MS,
  settleUserPendingTransactions,
} from "@/lib/wallet/settle-user-pending";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.ADMIN_CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return token === secret;
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [debits, withdrawals] = await Promise.all([
      settleStuckDebits(),
      settleStuckWithdrawals(),
    ]);
    const cutoff = new Date(Date.now() - PENDING_SETTLE_AFTER_MS);
    const stale = await db.query.transactions.findMany({
      where: and(
        inArray(transactions.status, ["pending", "processing"]),
        lte(transactions.createdAt, cutoff),
      ),
      columns: { userId: true },
      limit: 80,
    });
    const userIds = [...new Set(stale.map((row) => row.userId))];
    const userSettles = [];
    for (const userId of userIds) {
      userSettles.push(
        await settleUserPendingTransactions({ userId, limit: 8 }),
      );
    }
    return NextResponse.json({
      ok: true,
      debits,
      withdrawals,
      users: userSettles.length,
    });
  } catch (error) {
    console.error("[cron-settle-pending]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Settle failed" },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
