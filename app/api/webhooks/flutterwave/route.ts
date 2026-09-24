import { NextResponse } from "next/server";
import {
  isPaymentSuccessful,
  verifyFlutterwaveSignature,
} from "@/lib/flutterwave/client";
import { isProviderConfigError } from "@/lib/flutterwave/errors";
import {
  creditWalletFromDeposit,
  findUserIdForDepositCharge,
  reverseDeposit,
} from "@/lib/flutterwave/deposit-accounts";
import { settlePayoutTransfer } from "@/lib/flutterwave/transfers";
import {
  chargePayloadForLookup,
  parseFlutterwaveWebhook,
} from "@/lib/flutterwave/webhook-payload";
import { creditUsdWalletFromFunding } from "@/lib/wallet-usd";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("verif-hash") || req.headers.get("Verif-Hash");

    if (!verifyFlutterwaveSignature(signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    await ensureWalletSchema();

    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const parsed = parseFlutterwaveWebhook(body);
    const { eventName, data, meta, reference, amountMajor, status, isChargeSuccess } =
      parsed;

    if (!eventName && !reference) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (isChargeSuccess) {
      if (!isPaymentSuccessful(status)) {
        return NextResponse.json({ ok: true, ignored: true });
      }

      if (!reference || !Number.isFinite(amountMajor) || amountMajor <= 0) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      const purpose = meta?.purpose ?? meta?.Purpose;

      const lookupPayload = chargePayloadForLookup(data, meta);

      if (purpose === "usd_fund") {
        const userId =
          (typeof meta?.oryno_user_id === "string"
            ? meta.oryno_user_id
            : null) || (await findUserIdForDepositCharge(lookupPayload));
        if (!userId) {
          return NextResponse.json({ error: "User not found" }, { status: 404 });
        }
        const usdAmount = Number(meta?.usd_amount ?? 0);
        const result = await creditUsdWalletFromFunding({
          userId,
          reference: lookupPayload.tx_ref || reference,
          usdAmount: usdAmount > 0 ? usdAmount : undefined,
        });
        return NextResponse.json({ ok: true, purpose: "usd_fund", ...result });
      }

      if (purpose === "invoice_payment") {
        const slug =
          typeof meta?.paymentLinkSlug === "string"
            ? meta.paymentLinkSlug
            : null;
        if (slug) {
          const { markPaymentLinkPaid } = await import("@/lib/invoices");
          const result = await markPaymentLinkPaid({
            slug,
            reference,
            raw: data as Record<string, unknown>,
          });
          return NextResponse.json({
            ok: true,
            purpose: "invoice_payment",
            ...result,
          });
        }
      }

      const userId = await findUserIdForDepositCharge(lookupPayload);
      if (!userId) {
        console.error("[flutterwave-webhook] unmatched customer", {
          email: lookupPayload.customer?.email,
          account: lookupPayload.account_number,
          tx_ref: lookupPayload.tx_ref,
          flw_ref: lookupPayload.flw_ref,
          order_ref: lookupPayload.order_ref,
          event: eventName,
        });
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const result = await creditWalletFromDeposit({
        userId,
        amountKobo: Math.round(amountMajor * 100),
        currency:
          typeof data.currency === "string" ? data.currency : undefined,
        reference,
        channel:
          typeof data.payment_type === "string" ? data.payment_type : undefined,
        paidAt:
          typeof data.created_at === "string" ? data.created_at : undefined,
        raw: data,
      });

      if (result.duplicated) {
        console.info("[flutterwave-webhook] deposit already credited", {
          reference,
          fundingId: result.fundingId,
        });
      }

      return NextResponse.json({ ok: true, ...result });
    }

    if (
      eventName === "refund.completed" ||
      eventName === "charge.refunded" ||
      eventName === "charge.reversed"
    ) {
      if (!reference) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "no_reference",
        });
      }

      const reverseReason =
        (typeof data.complete_message === "string" && data.complete_message) ||
        "This deposit was reversed";
      if (isProviderConfigError(reverseReason)) {
        console.error(
          "[flutterwave-webhook] ignored deposit reverse — provider config error",
          reverseReason,
        );
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "provider_config_error",
        });
      }

      try {
        const result = await reverseDeposit({
          reference,
          reason: reverseReason,
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
      const transferReference =
        (typeof data.reference === "string" && data.reference) ||
        (typeof data.tx_ref === "string" && data.tx_ref) ||
        null;
      if (!transferReference) {
        return NextResponse.json(
          { error: "Missing reference" },
          { status: 400 },
        );
      }

      const payloadStatus = String(data.status || "").toLowerCase();
      const settledStatus = eventName.includes("reversed")
        ? "reversed"
        : eventName.includes("fail") ||
            payloadStatus.includes("fail") ||
            payloadStatus === "reversed"
          ? payloadStatus === "reversed"
            ? "reversed"
            : "failed"
          : isPaymentSuccessful(payloadStatus)
            ? "success"
            : null;

      if (!settledStatus) {
        return NextResponse.json({
          ok: true,
          ignored: true,
          reason: "transfer_not_final",
          status: payloadStatus || eventName,
        });
      }

      const result = await settlePayoutTransfer({
        reference: transferReference,
        status: settledStatus,
        transferCode: data.id != null ? String(data.id) : null,
        failureReason:
          (typeof data.complete_message === "string" && data.complete_message) ||
          (typeof data.status === "string" && data.status) ||
          null,
      });

      return NextResponse.json(result);
    }

    return NextResponse.json({ ok: true, ignored: true, event: eventName });
  } catch (error) {
    console.error("[flutterwave-webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
