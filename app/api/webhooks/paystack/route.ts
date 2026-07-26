import { NextResponse } from "next/server";
import { verifyPaystackSignature } from "@/lib/paystack/client";
import {
  creditWalletFromDeposit,
  findUserIdForPaystackCharge,
} from "@/lib/paystack/deposit-accounts";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

type PaystackWebhookBody = {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    status?: string;
    paid_at?: string;
    customer?: { customer_code?: string; email?: string };
    authorization?: { receiver_bank_account_number?: string };
    metadata?: Record<string, unknown> | null;
  };
};

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!verifyPaystackSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    await ensureWalletSchema();

    const body = JSON.parse(rawBody) as PaystackWebhookBody;
    if (body.event !== "charge.success" || !body.data) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const data = body.data;
    if (data.status && data.status !== "success") {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const reference =
      data.reference || (data.id != null ? `PSK_${data.id}` : null);
    if (!reference || !data.amount) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const userId = await findUserIdForPaystackCharge(data);
    if (!userId) {
      console.error("[paystack-webhook] unmatched customer", {
        customer: data.customer?.customer_code,
        email: data.customer?.email,
        account: data.authorization?.receiver_bank_account_number,
      });
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const result = await creditWalletFromDeposit({
      userId,
      amountKobo: data.amount,
      currency: data.currency,
      reference,
      channel: data.channel,
      paidAt: data.paid_at,
      raw: data as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[paystack-webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
