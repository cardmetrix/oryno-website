import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bettingOrders, transactions } from "@/lib/db/schema";
import {
  type PairgateWebhookPayload,
  verifyPairgateWebhookSignature,
} from "@/lib/betting/pairgate";
import { refundFailedDebit, reverseCompletedDebit } from "@/lib/wallet/ledger";

export const runtime = "nodejs";

/**
 * Pairgate transaction webhook.
 * Configure this URL on your Pairgate API key:
 *   https://YOUR_DOMAIN/api/webhooks/pairgate
 *
 * Docs: https://pairgate.com/developers/webhooks
 * Optional HMAC: set PAIRGATE_WEBHOOK_SECRET from the dashboard.
 */
export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get("x-pairgate-timestamp");
    const signature = req.headers.get("x-pairgate-signature");

    const verified = verifyPairgateWebhookSignature({
      rawBody,
      timestamp,
      signature,
    });
    if (!verified.ok) {
      return NextResponse.json(
        { error: verified.message || "Unauthorized" },
        { status: 401 },
      );
    }

    let body: PairgateWebhookPayload;
    try {
      body = JSON.parse(rawBody) as PairgateWebhookPayload;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const event = String(body.event || "");
    // Accept betting events; also settle if item/reference looks like a bet order
    const isBet =
      /bet/i.test(event) ||
      Boolean(body.item && /bet/i.test(String(body.item)));

    const referenceCode = String(body.reference_code || "").trim();
    const clientRef = String(body.reference || "").trim();
    if (!referenceCode && !clientRef) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const order =
      (referenceCode
        ? await db.query.bettingOrders.findFirst({
            where: eq(bettingOrders.providerRef, referenceCode),
          })
        : null) ||
      (clientRef
        ? await db.query.bettingOrders.findFirst({
            where: sql`${bettingOrders.metadata}->>'requestId' = ${clientRef}`,
          })
        : null) ||
      (referenceCode
        ? await db.query.bettingOrders.findFirst({
            where: sql`${bettingOrders.metadata}->>'requestId' = ${referenceCode}`,
          })
        : null);

    if (!order) {
      // Not our betting order (could be airtime/data webhook on same key)
      return NextResponse.json({
        ok: true,
        ignored: true,
        bet: isBet,
      });
    }

    const status = String(body.status || "").toLowerCase();
    const success = status === "successful" || status === "success" || status === "completed";
    const failed = status === "failed" || status === "fail" || status === "error";
    const reason = body.message || "Pairgate declined";

    const tx = order.transactionId
      ? await db.query.transactions.findFirst({
          where: eq(transactions.id, order.transactionId),
        })
      : null;

    if (success) {
      if (order.status !== "completed") {
        await db
          .update(bettingOrders)
          .set({
            status: "completed",
            providerRef: referenceCode || order.providerRef,
            failureReason: null,
            metadata: {
              ...(order.metadata || {}),
              pairgateWebhook: body,
              settledAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(bettingOrders.id, order.id));
      }
      if (tx && tx.status !== "completed") {
        const prev = (tx.metadata || {}) as Record<string, unknown>;
        await db
          .update(transactions)
          .set({
            status: "completed",
            externalRef: referenceCode || tx.externalRef,
            metadata: { ...prev, pairgateWebhook: body },
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));
      }
      return NextResponse.json({ ok: true, settled: true });
    }

    if (failed) {
      if (order.status !== "failed") {
        await db
          .update(bettingOrders)
          .set({
            status: "failed",
            failureReason: reason,
            providerRef: referenceCode || order.providerRef,
            metadata: {
              ...(order.metadata || {}),
              pairgateWebhook: body,
              settledAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          })
          .where(eq(bettingOrders.id, order.id));
      }

      if (tx) {
        if (tx.status === "completed") {
          await reverseCompletedDebit({
            walletId: tx.walletId,
            transactionId: tx.id,
            amount: Number(tx.amount),
            reason,
          });
        } else if (tx.status === "processing" || tx.status === "pending") {
          await refundFailedDebit({
            walletId: tx.walletId,
            transactionId: tx.id,
            amount: Number(tx.amount),
            reason,
          });
        }
      }

      return NextResponse.json({ ok: true, refunded: true });
    }

    return NextResponse.json({ ok: true, pending: true });
  } catch (error) {
    console.error("[pairgate-webhook]", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
