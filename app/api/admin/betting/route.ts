import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { titleCaseStatus, withAdminApi } from "@/lib/admin/api";
import { BETTING_PROVIDERS, isBettingDemoMode } from "@/lib/betting";
import { db } from "@/lib/db";
import { bettingOrders } from "@/lib/db/schema";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    await ensureWalletSchema();

    const recent = await db
      .select({
        id: bettingOrders.id,
        providerName: bettingOrders.providerName,
        customerRef: bettingOrders.customerRef,
        customerName: bettingOrders.customerName,
        amount: bettingOrders.amount,
        status: bettingOrders.status,
        providerRef: bettingOrders.providerRef,
        createdAt: bettingOrders.createdAt,
      })
      .from(bettingOrders)
      .orderBy(desc(bettingOrders.createdAt))
      .limit(30);

    return NextResponse.json({
      ok: true,
      demo: isBettingDemoMode(),
      providers: BETTING_PROVIDERS.map((p) => ({
        id: p.serviceID,
        name: p.name,
        status: "Active",
        minAmount: p.minAmount,
        maxAmount: p.maxAmount,
      })),
      recent: recent.map((r) => ({
        id: r.id,
        provider: r.providerName,
        customerRef: r.customerRef,
        customerName: r.customerName || "—",
        amount: r.amount,
        status: titleCaseStatus(r.status),
        reference: r.providerRef || "—",
        when: r.createdAt ? new Date(r.createdAt).toLocaleString("en-NG") : "—",
      })),
    });
  });
}
