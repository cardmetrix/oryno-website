import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createInvoice, listUserInvoices } from "@/lib/invoices";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rows = await listUserInvoices(user.id);
    return NextResponse.json({
      invoices: rows.map((row) => ({
        id: row.id,
        number: row.number,
        customerName: row.customerName,
        total: row.total,
        totalFormatted: formatMoney(Number(row.total), row.currency),
        currency: row.currency,
        status: row.status,
        createdAt: row.createdAt,
      })),
    });
  } catch (error) {
    console.error("[invoices-get]", error);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await req.json()) as {
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      currency?: string;
      notes?: string;
      items?: Array<{ description: string; quantity: number; unitPrice: number }>;
    };
    const created = await createInvoice({
      userId: user.id,
      countryCode: user.countryCode,
      customerName: body.customerName || "",
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
      currency: body.currency,
      notes: body.notes,
      items: body.items || [],
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
