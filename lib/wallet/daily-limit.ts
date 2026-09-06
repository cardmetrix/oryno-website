import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, users } from "@/lib/db/schema";
import {
  dailyLimitForLevel,
  formatLevelLimit,
} from "@/lib/account-levels";
import { formatCountryMoney } from "@/lib/country";

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

export async function assertDailyTransactionLimit(input: {
  userId: string;
  amountNgn: number;
  countryCode?: string | null;
}) {
  if (!Number.isFinite(input.amountNgn) || input.amountNgn <= 0) return;

  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
    columns: { id: true, kycLevel: true, countryCode: true },
  });
  if (!user) throw new Error("User not found");

  const limit = dailyLimitForLevel(user.kycLevel);
  if (limit == null) return;

  const spent = await getDailySpendNgn(input.userId);
  const remaining = Math.max(0, limit - spent);
  const countryCode = input.countryCode || user.countryCode || "NG";

  if (input.amountNgn - remaining > 1e-6) {
    throw new DailyLimitError(
      remaining <= 0
        ? `You have reached your ${formatLevelLimit(limit, countryCode)} daily transaction limit. Upgrade your account level to continue.`
        : `This exceeds your remaining daily limit of ${formatCountryMoney(remaining, countryCode)}. Upgrade your account level for a higher limit.`,
    );
  }
}
