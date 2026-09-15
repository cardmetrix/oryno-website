import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  airtimeOrders,
  bettingOrders,
  billPayments,
  dataOrders,
  transactions,
} from "@/lib/db/schema";
import {
  type PairgateWebhookPayload,
  verifyPairgateWebhookSignature,
} from "@/lib/pairgate/http";
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
type SettledKind = "betting" | "airtime" | "data" | "bill";

async function findOrderByRefs(referenceCode: string, clientRef: string) {
  const refs = [referenceCode, clientRef].filter(Boolean);

  for (const ref of refs) {
    const betting =
      (await db.query.bettingOrders.findFirst({
        where: eq(bettingOrders.providerRef, ref),
      })) ||
      (await db.query.bettingOrders.findFirst({
        where: sql`${bettingOrders.metadata}->>'requestId' = ${ref}`,
      }));
    if (betting) return { kind: "betting" as const, order: betting };

    const airtime = await db.query.airtimeOrders.findFirst({
      where: eq(airtimeOrders.providerRef, ref),
    });
    if (airtime) return { kind: "airtime" as const, order: airtime };

    const data = await db.query.dataOrders.findFirst({
      where: eq(dataOrders.providerRef, ref),
    });
    if (data) return { kind: "data" as const, order: data };

    const bill = await db.query.billPayments.findFirst({
      where: eq(billPayments.providerRef, ref),
    });
    if (bill) return { kind: "bill" as const, order: bill };
  }

  for (const ref of refs) {
    const tx =
      (await db.query.transactions.findFirst({
        where: eq(transactions.externalRef, ref),
      })) ||
      (await db.query.transactions.findFirst({
        where: sql`${transactions.metadata}->>'requestId' = ${ref}`,
      }));
    if (!tx) continue;

    const meta = (tx.metadata || {}) as Record<string, unknown>;
    if (meta.provider !== "pairgate" && meta.provider !== undefined) continue;

    if (tx.category === "airtime") {
      const airtime = await db.query.airtimeOrders.findFirst({
        where: eq(airtimeOrders.transactionId, tx.id),
      });
      if (airtime) return { kind: "airtime" as const, order: airtime };
    }
    if (tx.category === "data") {
      const data = await db.query.dataOrders.findFirst({
        where: eq(dataOrders.transactionId, tx.id),
      });
      if (data) return { kind: "data" as const, order: data };
    }
    if (tx.category === "bill") {
      const bill = await db.query.billPayments.findFirst({
        where: eq(billPayments.transactionId, tx.id),
      });
      if (bill) return { kind: "bill" as const, order: bill };
    }
    if (tx.category === "betting") {
      const betting = await db.query.bettingOrders.findFirst({
        where: eq(bettingOrders.transactionId, tx.id),
      });
      if (betting) return { kind: "betting" as const, order: betting };
    }
  }

  return null;
}

async function markOrder(
  kind: SettledKind,
  orderId: string,
  patch: {
    status: "completed" | "failed";
    providerRef?: string | null;
    failureReason?: string | null;
    tokenOrReceipt?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (kind === "betting") {
    await db
      .update(bettingOrders)
      .set({
        status: patch.status,
        providerRef: patch.providerRef ?? undefined,
        failureReason: patch.failureReason ?? null,
        metadata: patch.metadata,
        updatedAt: new Date(),
      })
      .where(eq(bettingOrders.id, orderId));
    return;
  }
  if (kind === "airtime") {
    await db
      .update(airtimeOrders)
      .set({
        status: patch.status,
        providerRef: patch.providerRef ?? undefined,
        failureReason: patch.failureReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(airtimeOrders.id, orderId));
    return;
  }
  if (kind === "data") {
    await db
      .update(dataOrders)
      .set({
        status: patch.status,
        providerRef: patch.providerRef ?? undefined,
        failureReason: patch.failureReason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(dataOrders.id, orderId));
    return;
  }
  await db
    .update(billPayments)
    .set({
      status: patch.status,
      providerRef: patch.providerRef ?? undefined,
      failureReason: patch.failureReason ?? null,
      ...(patch.tokenOrReceipt != null
        ? { tokenOrReceipt: patch.tokenOrReceipt }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(billPayments.id, orderId));
}

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

    const referenceCode = String(body.reference_code || "").trim();
    const clientRef = String(body.reference || "").trim();
    if (!referenceCode && !clientRef) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const found = await findOrderByRefs(referenceCode, clientRef);
    if (!found) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const { kind, order } = found;
    const status = String(body.status || "").toLowerCase();
    const success =
      status === "successful" || status === "success" || status === "completed";
    const failed =
      status === "failed" || status === "fail" || status === "error";
    const reason = body.message || "Pairgate declined";
    const pin = body.pin ? String(body.pin).trim() : null;

    const tx = order.transactionId
      ? await db.query.transactions.findFirst({
          where: eq(transactions.id, order.transactionId),
        })
      : null;

    if (success) {
      if (order.status !== "completed") {
        const meta =
          kind === "betting"
            ? {
                ...((order as typeof bettingOrders.$inferSelect).metadata || {}),
                pairgateWebhook: body,
                settledAt: new Date().toISOString(),
              }
            : undefined;
        await markOrder(kind, order.id, {
          status: "completed",
          providerRef: referenceCode || order.providerRef,
          failureReason: null,
          tokenOrReceipt: kind === "bill" ? pin : null,
          metadata: meta,
        });
      } else if (kind === "bill" && pin) {
        await db
          .update(billPayments)
          .set({
            tokenOrReceipt: pin,
            providerRef: referenceCode || order.providerRef,
            updatedAt: new Date(),
          })
          .where(eq(billPayments.id, order.id));
      }

      if (tx && tx.status !== "completed") {
        const prev = (tx.metadata || {}) as Record<string, unknown>;
        await db
          .update(transactions)
          .set({
            status: "completed",
            externalRef: referenceCode || tx.externalRef,
            metadata: {
              ...prev,
              pairgateWebhook: body,
              ...(pin ? { token: pin } : {}),
            },
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, tx.id));

        const { scheduleReferralCheck } = await import(
          "@/lib/referrals/service"
        );
        scheduleReferralCheck(tx.userId);
      }

      return NextResponse.json({ ok: true, settled: true, kind });
    }

    if (failed) {
      if (order.status !== "failed") {
        const meta =
          kind === "betting"
            ? {
                ...((order as typeof bettingOrders.$inferSelect).metadata || {}),
                pairgateWebhook: body,
                settledAt: new Date().toISOString(),
              }
            : undefined;
        await markOrder(kind, order.id, {
          status: "failed",
          providerRef: referenceCode || order.providerRef,
          failureReason: reason,
          metadata: meta,
        });
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

      return NextResponse.json({ ok: true, refunded: true, kind });
    }

    return NextResponse.json({ ok: true, pending: true, kind });
  } catch (error) {
    console.error("[pairgate-webhook]", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
