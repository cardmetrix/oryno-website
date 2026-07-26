import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import {
  groupTransactionsByDate,
  toAppTransaction,
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

    const items = rows.map(toAppTransaction);

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
