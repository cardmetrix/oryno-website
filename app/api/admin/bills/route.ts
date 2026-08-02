import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { billPayments, billProviders, countries } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const providers = await db
      .select({
        id: billProviders.id,
        name: billProviders.name,
        category: billProviders.category,
        status: billProviders.status,
        countryCode: billProviders.countryCode,
        countryName: countries.name,
      })
      .from(billProviders)
      .leftJoin(countries, eq(billProviders.countryCode, countries.code))
      .orderBy(billProviders.name)
      .limit(80);

    const recent = await db
      .select({
        id: billPayments.id,
        status: billPayments.status,
        amount: billPayments.amount,
        customerRef: billPayments.customerRef,
        createdAt: billPayments.createdAt,
        providerName: billProviders.name,
      })
      .from(billPayments)
      .innerJoin(billProviders, eq(billPayments.providerId, billProviders.id))
      .orderBy(desc(billPayments.createdAt))
      .limit(20);

    return NextResponse.json({
      ok: true,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        category: titleCaseStatus(p.category),
        country: p.countryName || p.countryCode || "—",
        status: titleCaseStatus(p.status),
      })),
      recent: recent.map((r) => ({
        id: r.id,
        provider: r.providerName,
        customerRef: r.customerRef,
        amount: r.amount,
        status: titleCaseStatus(r.status),
        when: r.createdAt
          ? new Date(r.createdAt).toLocaleString("en-NG")
          : "—",
      })),
    });
  });
}
