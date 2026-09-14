import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { titleCaseStatus, withAdminApi } from "@/lib/admin/api";
import {
  BETTING_PROVIDERS_BY_COUNTRY,
  isBettingDemoMode,
} from "@/lib/betting";
import { getServiceCharge } from "@/lib/company/charges";
import { db } from "@/lib/db";
import { bettingOrders, companyRevenueEntries } from "@/lib/db/schema";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    await ensureWalletSchema();

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recent, volumeRows, revenueRows, charge] = await Promise.all([
      db
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
        .limit(30),
      db
        .select({
          volume: sql<string>`coalesce(sum(${bettingOrders.amount}), 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(bettingOrders)
        .where(
          and(
            eq(bettingOrders.status, "completed"),
            gte(bettingOrders.createdAt, since),
          ),
        ),
      db
        .select({
          profit: sql<string>`coalesce(sum(${companyRevenueEntries.profitAmount}), 0)`,
          count: sql<number>`count(*)::int`,
        })
        .from(companyRevenueEntries)
        .where(
          and(
            eq(companyRevenueEntries.source, "betting"),
            eq(companyRevenueEntries.currency, "NGN"),
            gte(companyRevenueEntries.createdAt, since),
          ),
        ),
      getServiceCharge("betting"),
    ]);

    const volume30d = Number(volumeRows[0]?.volume ?? 0);
    const completed30d = Number(volumeRows[0]?.count ?? 0);
    const profit30d = Number(revenueRows[0]?.profit ?? 0);
    const revenueEntries30d = Number(revenueRows[0]?.count ?? 0);

    return NextResponse.json({
      ok: true,
      demo: isBettingDemoMode(),
      revenue: {
        volume30d,
        completed30d,
        profit30d,
        revenueEntries30d,
        charge: {
          mode: charge.mode,
          value: charge.value,
          enabled: charge.enabled,
        },
      },
      providers: Object.entries(BETTING_PROVIDERS_BY_COUNTRY).flatMap(
        ([country, list]) =>
          list.map((p) => ({
            id: `${country}:${p.serviceID}`,
            name: `${p.name} (${country})`,
            status: country === "NG" ? "Active" : "Catalog",
            minAmount: p.minAmount,
            maxAmount: p.maxAmount,
          })),
      ),
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
