import { NextResponse } from "next/server";
import {
  getPaymentLinkBySlug,
  initiatePaymentLinkCheckout,
  markPaymentLinkPaid,
  INVOICE_FOOTER,
} from "@/lib/invoices";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const packed = await getPaymentLinkBySlug(slug);
    if (!packed) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      title: packed.link.title,
      amount: packed.link.amount,
      amountFormatted: formatMoney(Number(packed.link.amount), packed.link.currency),
      currency: packed.link.currency,
      status: packed.link.status,
      customerName: packed.invoice?.customerName ?? null,
      invoiceNumber: packed.invoice?.number ?? null,
      footer: INVOICE_FOOTER,
    });
  } catch (error) {
    console.error("[pay-get]", error);
    return NextResponse.json({ error: "Failed to load payment link" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      email?: string;
      name?: string;
      markPaid?: boolean;
    };
    const origin = new URL(req.url).origin;
    if (body.markPaid) {
      await markPaymentLinkPaid({ slug, reference: `MANUAL_${Date.now()}`, raw: body });
      return NextResponse.json({ ok: true, paid: true });
    }
    const checkout = await initiatePaymentLinkCheckout({
      slug,
      customerEmail: body.email,
      customerName: body.name,
      origin,
    });
    return NextResponse.json({ ok: true, ...checkout });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
