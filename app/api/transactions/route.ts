import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import {
  formatMoney,
  groupTransactionsByDate,
  mapDbStatus,
  type AppTransaction,
} from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await db.query.transactions.findMany({
      where: eq(transactions.userId, user.id),
      orderBy: [desc(transactions.createdAt)],
      limit: 100,
    });

    const items: AppTransaction[] = rows.map((row) => {
      const credit = row.type === "credit";
      const signed = formatMoney(row.amount, row.currency);
      return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle || row.category.replace(/_/g, " "),
        amount: `${credit ? "+" : "-"}${signed}`,
        type: credit ? "credit" : "debit",
        status: mapDbStatus(row.status),
        category: row.category,
        currency: row.currency,
        createdAt: row.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      items,
      groups: groupTransactionsByDate(items),
      count: items.length,
    });
  } catch (error) {
    console.error("[transactions-get]", error);
    return NextResponse.json(
      { error: "Failed to load transactions" },
      { status: 500 },
    );
  }
}
