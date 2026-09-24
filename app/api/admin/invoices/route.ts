import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { listAdminInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/transactions";
import { db } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const rows = await listAdminInvoices(80);
    const settings = await db.query.platformSettings.findFirst({
      where: eq(platformSettings.key, "invoices"),
    });
    return NextResponse.json({
      ok: true,
      settings: (settings?.value as Record<string, unknown>) || {
        enabled: true,
        paymentLinksEnabled: true,
      },
      invoices: rows.map((row) => ({
        id: row.number,
        customer: row.customerName,
        amount: formatMoney(Number(row.total), row.currency),
        status: titleCaseStatus(row.status),
        createdAt: row.createdAt,
      })),
    });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async () => {
    const body = (await req.json()) as {
      enabled?: boolean;
      paymentLinksEnabled?: boolean;
    };
    const value = {
      enabled: body.enabled !== false,
      paymentLinksEnabled: body.paymentLinksEnabled !== false,
    };
    await db
      .insert(platformSettings)
      .values({ key: "invoices", value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.key,
        set: { value, updatedAt: new Date() },
      });
    return NextResponse.json({ ok: true, settings: value });
  });
}
