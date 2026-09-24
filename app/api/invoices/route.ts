import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  createInvoice,
  getInvoiceSettings,
  listUserInvoices,
} from "@/lib/invoices";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rows = await listUserInvoices(user.id);
    return NextResponse.json({ invoices: rows });
  } catch (error) {
    console.error("[invoices-get]", error);
    return NextResponse.json({ error: "Failed to load invoices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await getInvoiceSettings();
    if (!settings.enabled) {
      return NextResponse.json(
        { error: "Invoice generator is temporarily disabled" },
        { status: 403 },
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const items = Array.isArray(body.items)
      ? (body.items as Array<{
          description: string;
          quantity: number;
          unitPrice: number;
        }>)
      : [];

    const created = await createInvoice({
      userId: user.id,
      countryCode: user.countryCode,
      currency: typeof body.currency === "string" ? body.currency : undefined,
      status: body.status === "draft" ? "draft" : "sent",
      fromName:
        (typeof body.fromName === "string" ? body.fromName : null) ||
        user.fullName,
      fromEmail:
        (typeof body.fromEmail === "string" ? body.fromEmail : null) ||
        user.email,
      fromPhone: typeof body.fromPhone === "string" ? body.fromPhone : null,
      fromAddress:
        typeof body.fromAddress === "string" ? body.fromAddress : null,
      customerName:
        typeof body.customerName === "string" ? body.customerName : "",
      customerEmail:
        typeof body.customerEmail === "string" ? body.customerEmail : null,
      customerPhone:
        typeof body.customerPhone === "string" ? body.customerPhone : null,
      customerAddress:
        typeof body.customerAddress === "string"
          ? body.customerAddress
          : null,
      shipToName: typeof body.shipToName === "string" ? body.shipToName : null,
      shipToAddress:
        typeof body.shipToAddress === "string" ? body.shipToAddress : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      terms: typeof body.terms === "string" ? body.terms : null,
      paymentTerms:
        typeof body.paymentTerms === "string" ? body.paymentTerms : null,
      poNumber: typeof body.poNumber === "string" ? body.poNumber : null,
      issuedAt: typeof body.issuedAt === "string" ? body.issuedAt : null,
      dueAt: typeof body.dueAt === "string" ? body.dueAt : null,
      taxRate: Number(body.taxRate) || 0,
      discount: Number(body.discount) || 0,
      shipping: Number(body.shipping) || 0,
      amountPaid: Number(body.amountPaid) || 0,
      items,
    });
    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create invoice";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
