import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  createStandalonePaymentLink,
  getInvoiceSettings,
  listUserPaymentLinks,
} from "@/lib/invoices";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const links = await listUserPaymentLinks(user.id);
    return NextResponse.json({ links });
  } catch (error) {
    console.error("[payment-links-get]", error);
    return NextResponse.json(
      { error: "Failed to load payment links" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
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

    const body = (await req.json()) as {
      title?: string;
      amount?: number;
      currency?: string;
      customerName?: string;
      customerEmail?: string;
      note?: string;
    };

    const origin =
      req.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const created = await createStandalonePaymentLink({
      userId: user.id,
      title: body.title || "",
      amount: Number(body.amount) || 0,
      currency: body.currency,
      countryCode: user.countryCode,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      note: body.note,
      origin,
    });

    return NextResponse.json({ ok: true, ...created });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create payment link";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
