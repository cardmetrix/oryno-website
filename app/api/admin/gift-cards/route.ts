import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import {
  giftCardBrands,
  giftCardOrders,
  giftCardRates,
  users,
} from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const rates = await db
      .select({
        brand: giftCardBrands.name,
        status: giftCardRates.status,
        buyRate: giftCardRates.buyRate,
        sellRate: giftCardRates.sellRate,
        countryCode: giftCardRates.countryCode,
      })
      .from(giftCardRates)
      .innerJoin(giftCardBrands, eq(giftCardRates.brandId, giftCardBrands.id))
      .orderBy(giftCardBrands.name)
      .limit(50);

    const brands = await db
      .select({
        name: giftCardBrands.name,
        status: giftCardBrands.status,
        category: giftCardBrands.category,
      })
      .from(giftCardBrands)
      .orderBy(giftCardBrands.name)
      .limit(50);

    const orders = await db
      .select({
        reference: giftCardOrders.reference,
        side: giftCardOrders.side,
        status: giftCardOrders.status,
        amountUsd: giftCardOrders.amountUsd,
        userName: users.fullName,
        brandName: giftCardBrands.name,
      })
      .from(giftCardOrders)
      .innerJoin(users, eq(giftCardOrders.userId, users.id))
      .innerJoin(giftCardBrands, eq(giftCardOrders.brandId, giftCardBrands.id))
      .orderBy(desc(giftCardOrders.createdAt))
      .limit(40);

    return NextResponse.json({
      ok: true,
      rates:
        rates.length > 0
          ? rates.map((r) => ({
              brand: r.brand,
              buy: `₦${Number(r.buyRate).toLocaleString("en-NG")}/$`,
              sell: `₦${Number(r.sellRate).toLocaleString("en-NG")}/$`,
              status: titleCaseStatus(r.status),
            }))
          : brands.map((b) => ({
              brand: b.name,
              buy: "—",
              sell: "—",
              status: titleCaseStatus(b.status),
            })),
      orders: orders.map((o) => ({
        id: o.reference,
        user: o.userName,
        brand: o.brandName,
        type: o.side === "buy" ? "Buy" : "Sell",
        amount: `$${Number(o.amountUsd).toFixed(0)}`,
        status: titleCaseStatus(o.status),
      })),
    });
  });
}
