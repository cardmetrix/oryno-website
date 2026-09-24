import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  createPaymentLinkForInvoice,
  getInvoiceSettings,
} from "@/lib/invoices";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await getInvoiceSettings();
    if (!settings.paymentLinksEnabled) {
      return NextResponse.json(
        { error: "Payment links are temporarily disabled" },
        { status: 403 },
      );
    }

    const { id } = await ctx.params;
    const origin = new URL(req.url).origin;
    const result = await createPaymentLinkForInvoice({
      userId: user.id,
      invoiceId: id,
      origin,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
