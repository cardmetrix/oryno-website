import { count, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const byDay = await db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${transactions.createdAt}), 'YYYY-MM-DD')`,
        total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
        count: count(),
      })
      .from(transactions)
      .where(gte(transactions.createdAt, monthAgo))
      .groupBy(sql`date_trunc('day', ${transactions.createdAt})`)
      .orderBy(sql`date_trunc('day', ${transactions.createdAt})`);

    const byCategory = await db
      .select({
        category: transactions.category,
        total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
        count: count(),
      })
      .from(transactions)
      .where(gte(transactions.createdAt, monthAgo))
      .groupBy(transactions.category)
      .orderBy(sql`sum(${transactions.amount}::numeric) desc`);

    const byStatus = await db
      .select({
        status: transactions.status,
        count: count(),
      })
      .from(transactions)
      .where(gte(transactions.createdAt, monthAgo))
      .groupBy(transactions.status);

    const volume = byDay.reduce((s, d) => s + Number(d.total || 0), 0);
    const txCount = byDay.reduce((s, d) => s + Number(d.count || 0), 0);

    return NextResponse.json({
      ok: true,
      summary: {
        volume30d: formatMoney(volume, "NGN"),
        transactions30d: txCount,
      },
      series: byDay.map((d) => ({
        day: d.day,
        total: Number(d.total || 0),
        count: Number(d.count || 0),
      })),
      categories: byCategory.map((c) => ({
        category: titleCaseStatus(c.category),
        total: formatMoney(c.total || 0, "NGN"),
        count: Number(c.count || 0),
      })),
      statuses: byStatus.map((s) => ({
        status: titleCaseStatus(s.status),
        count: Number(s.count || 0),
      })),
    });
  });
}
