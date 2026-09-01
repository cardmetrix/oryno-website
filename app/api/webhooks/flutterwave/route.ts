import { NextResponse } from "next/server";
import {
  isPaymentSuccessful,
  normalizeFlutterwaveMeta,
  verifyFlutterwaveSignature,
} from "@/lib/flutterwave/client";
import {
  creditWalletFromDeposit,
  findUserIdForDepositCharge,
  reverseDeposit,
} from "@/lib/flutterwave/deposit-accounts";
import { settlePayoutTransfer } from "@/lib/flutterwave/transfers";
import { creditUsdWalletFromFunding } from "@/lib/wallet-usd";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

type FlutterwaveWebhookBody = {
  event?: string;
  "event.type"?: string;
  data?: {
    id?: number;
    tx_ref?: string;
    flw_ref?: string;
    reference?: string;
    amount?: number;
    charged_amount?: number;
    currency?: string;
    status?: string;
    payment_type?: string;
    created_at?: string;
    complete_message?: string | null;
    account_number?: string;
    customer?: { email?: string; id?: number; name?: string };
    meta?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  };
};

function asMeta(raw: unknown): Record<string, unknown> | null {
  return normalizeFlutterwaveMeta(raw);
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("verif-hash") || req.headers.get("Verif-Hash");

    if (!verifyFlutterwaveSignature(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    await ensureWalletSchema();

    const body = JSON.parse(rawBody) as FlutterwaveWebhookBody;
    const event = body.event || body["event.type"];
    const data = body.data;

    if (!event || !data) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const eventName = event.toLowerCase();

    if (
      eventName === "charge.completed" ||
      eventName === "charge.success"
    ) {
      if (!isPaymentSuccessful(data.status)) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      const reference =
        data.tx_ref ||
        data.flw_ref ||
        (data.id != null ? `FLW_${data.id}` : null);
      const amountMajor = Number(data.charged_amount ?? data.amount);
      if (!reference || !Number.isFinite(amountMajor) || amountMajor <= 0) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const meta = asMeta(data.meta) ?? asMeta(data.metadata);
      const purpose = meta?.purpose ?? meta?.Purpose;

      if (purpose === "usd_fund") {
        const userId =
          (typeof meta?.oryno_user_id === "string"
            ? meta.oryno_user_id
            : null) || (await findUserIdForDepositCharge({ ...data, meta }));
        if (!userId) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const usdAmount = Number(meta?.usd_amount ?? 0);
        const result = await creditUsdWalletFromFunding({
          userId,
          reference,
          usdAmount: usdAmount > 0 ? usdAmount : undefined,
        });
        return NextResponse.json({ ok: true, purpose: "usd_fund", ...result });
      }

      const userId = await findUserIdForDepositCharge({ ...data, meta });
      if (!userId) {
        console.error("[flutterwave-webhook] unmatched customer", {
          email: data.customer?.email,
          account: data.account_number,
          tx_ref: data.tx_ref,
        });
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const result = await creditWalletFromDeposit({
        userId,
        amountKobo: Math.round(amountMajor * 100),
        currency: data.currency,
        reference,
        channel: data.payment_type,
        paidAt: data.created_at,
        raw: data as unknown as Record<string, unknown>,
      });

      return NextResponse.json({ ok: true, ...result });
    }

    if (
      eventName === "refund.completed" ||
      eventName === "charge.refunded" ||
      eventName === "charge.reversed"
    ) {
      const nested = data as { transaction?: { tx_ref?: string; reference?: string } };
      const reference =
        data.tx_ref ||
        data.flw_ref ||
        nested.transaction?.tx_ref ||
        nested.transaction?.reference ||
        data.reference ||
        null;
      if (!reference) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "no_reference",
        });
      }

      try {
        const result = await reverseDeposit({
          reference,
          reason: data.complete_message || "This deposit was reversed",
        });
        return NextResponse.json(result);
      } catch (error) {
        console.error("[flutterwave-webhook-deposit-reverse]", error);
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Deposit reverse failed",
          },
          { status: 500 },
        );
      }
    }

    if (
      eventName === "transfer.completed" ||
      eventName === "transfer.success" ||
      eventName === "transfer.failed" ||
      eventName === "transfer.reversed"
    ) {
      const reference = data.reference || data.tx_ref;
      if (!reference) {
        return NextResponse.json(
          { error: "Missing reference" },
          { status: 400 },
        );
      }

      const result = await settlePayoutTransfer({
        reference,
        status: eventName.includes("reversed")
          ? "reversed"
          : eventName.includes("fail")
            ? "failed"
            : "success",
        transferCode: data.id != null ? String(data.id) : null,
        failureReason: data.complete_message ?? data.status ?? null,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: true, ignored: true });
  } catch (error) {
    console.error("[flutterwave-webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
