import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import {
  getInvoiceSettings,
  listAdminInvoices,
  setInvoiceSettings,
} from "@/lib/invoices";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const [rows, settings] = await Promise.all([
      listAdminInvoices(80),
      getInvoiceSettings(),
    ]);
    return NextResponse.json({
      ok: true,
      settings,
      invoices: rows.map((row) => ({
        id: row.number,
        customer: row.customerName,
        amount: row.totalFormatted,
        status: titleCaseStatus(row.status),
        createdAt: row.createdAt,
        user: row.user,
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
    const settings = await setInvoiceSettings(body);
    return NextResponse.json({ ok: true, settings });
  });
}
