import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { countryStatusLabel } from "@/lib/admin/countries";
import { db } from "@/lib/db";
import {
  countries,
  giftCardBrands,
  giftCardOrders,
  transactions,
  users,
} from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const now = Date.now();
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [userCount] = await db.select({ value: count() }).from(users);
    const [countryCount] = await db
      .select({ value: count() })
      .from(countries)
      .where(eq(countries.status, "live"));
    const [failed24h] = await db
      .select({ value: count() })
      .from(transactions)
      .where(
        and(eq(transactions.status, "failed"), gte(transactions.createdAt, dayAgo)),
      );

    const volumeRow = await db
      .select({
        total: sql<string>`coalesce(sum(${transactions.amount}::numeric), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.currency, "NGN"),
          gte(transactions.createdAt, monthAgo),
        ),
      );

    const volume = Number(volumeRow[0]?.total || 0);

    const recentOrders = await db
      .select({
        id: giftCardOrders.id,
        reference: giftCardOrders.reference,
        side: giftCardOrders.side,
        status: giftCardOrders.status,
        amountUsd: giftCardOrders.amountUsd,
        localAmount: giftCardOrders.localAmount,
        currency: giftCardOrders.currency,
        createdAt: giftCardOrders.createdAt,
        userName: users.fullName,
        brandName: giftCardBrands.name,
      })
      .from(giftCardOrders)
      .innerJoin(users, eq(giftCardOrders.userId, users.id))
      .innerJoin(giftCardBrands, eq(giftCardOrders.brandId, giftCardBrands.id))
      .orderBy(desc(giftCardOrders.createdAt))
      .limit(8);

    const recentTx = await db
      .select({
        id: transactions.id,
        title: transactions.title,
        category: transactions.category,
        status: transactions.status,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .orderBy(desc(transactions.createdAt))
      .limit(8);

    const countryRows = await db
      .select()
      .from(countries)
      .orderBy(countries.name)
      .limit(12);

    return NextResponse.json({
      ok: true,
      stats: [
        {
          label: "Total users",
          value: Number(userCount?.value || 0).toLocaleString("en-NG"),
          change: "All time",
          up: true,
        },
        {
          label: "Wallet volume (30d)",
          value: formatMoney(volume, "NGN"),
          change: "NGN ledger",
          up: true,
        },
        {
          label: "Live countries",
          value: String(countryCount?.value || 0),
          change: "Status = live",
          up: true,
        },
        {
          label: "Failed tx (24h)",
          value: String(failed24h?.value || 0),
          change: "Last 24 hours",
          up: Number(failed24h?.value || 0) === 0,
        },
      ],
      giftCardOrders: recentOrders.map((o) => ({
        id: o.reference,
        user: o.userName,
        brand: o.brandName,
        type: o.side === "buy" ? "Buy" : "Sell",
        amount: `$${Number(o.amountUsd).toFixed(0)}`,
        status: titleCaseStatus(o.status),
      })),
      activity: recentTx.map((t) => ({
        id: t.id,
        title: t.title,
        type: titleCaseStatus(t.category),
        time: t.createdAt
          ? new Date(t.createdAt).toLocaleString("en-NG", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "—",
      })),
      countries: countryRows.map((c) => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        services: (c.enabledServices || []).join(", ") || "—",
        gateway: "Paystack",
        status: countryStatusLabel(c.status),
      })),
    });
  });
}
