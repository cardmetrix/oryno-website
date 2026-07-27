import { NextResponse } from "next/server";
import { verifyPaystackSignature } from "@/lib/paystack/client";
import {
  creditWalletFromDeposit,
  findUserIdForPaystackCharge,
} from "@/lib/paystack/deposit-accounts";
import { settlePaystackTransfer } from "@/lib/paystack/transfers";
import { creditUsdWalletFromFunding } from "@/lib/wallet-usd";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

type PaystackWebhookBody = {
  event?: string;
  data?: {
    id?: number;
    reference?: string;
    transfer_code?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    status?: string;
    paid_at?: string;
    reason?: string | null;
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
    const event = body.event;
    const data = body.data;

    if (!event || !data) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (event === "charge.success") {
      if (data.status && data.status !== "success") {
        return NextResponse.json({ ok: true, ignored: true });
      }

      const reference =
        data.reference || (data.id != null ? `PSK_${data.id}` : null);
      if (!reference || !data.amount) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const purpose = data.metadata?.purpose ?? data.metadata?.Purpose;
      if (purpose === "usd_fund") {
        const userId =
          (typeof data.metadata?.oryno_user_id === "string"
            ? data.metadata.oryno_user_id
            : null) || (await findUserIdForPaystackCharge(data));
        if (!userId) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const usdAmount = Number(data.metadata?.usd_amount ?? 0);
        const result = await creditUsdWalletFromFunding({
          userId,
          reference,
          usdAmount: usdAmount > 0 ? usdAmount : undefined,
        });
        return NextResponse.json({ ok: true, purpose: "usd_fund", ...result });
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
    }

    if (
      event === "transfer.success" ||
      event === "transfer.failed" ||
      event === "transfer.reversed"
    ) {
      const reference = data.reference;
      if (!reference) {
        return NextResponse.json(
          { error: "Missing reference" },
          { status: 400 },
        );
      }

      const status =
        event === "transfer.success"
          ? ("success" as const)
          : event === "transfer.reversed"
            ? ("reversed" as const)
            : ("failed" as const);

      const result = await settlePaystackTransfer({
        reference,
        status,
        transferCode: data.transfer_code ?? null,
        failureReason: data.reason ?? data.status ?? null,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    console.error("[paystack-webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
