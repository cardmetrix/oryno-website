import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";

export class DailyLimitError extends Error {
  status = 400;
  code = "daily_limit_exceeded" as const;
  constructor(message: string) {
    super(message);
    this.name = "DailyLimitError";
  }
}

export function isDailyLimitError(error: unknown): error is DailyLimitError {
  return (
    error instanceof DailyLimitError ||
    (error as { code?: string } | null)?.code === "daily_limit_exceeded"
  );
}

function startOfUtcDay(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

const COUNTED_DEBIT_CATEGORIES = [
  "withdraw",
  "airtime",
  "data",
  "bill",
  "gift_card",
  "social",
  "virtual_number",
  "betting",
] as const;

export async function getDailySpendNgn(userId: string) {
  const since = startOfUtcDay();
  const [row] = await db
    .select({
      spent: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "debit"),
        inArray(transactions.status, ["completed", "processing", "pending"]),
        inArray(transactions.category, [...COUNTED_DEBIT_CATEGORIES]),
        gte(transactions.createdAt, since),
      ),
    );
  return Number(row?.spent ?? 0);
}

/** Phase 1: KYC daily spend limits are disabled. */
export async function assertDailyTransactionLimit(_input: {
  userId: string;
  amountNgn: number;
  countryCode?: string | null;
}) {
  return;
}
