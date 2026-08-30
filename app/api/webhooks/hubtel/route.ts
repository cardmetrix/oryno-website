import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { billPayments, transactions } from "@/lib/db/schema";
import { refundFailedDebit, reverseCompletedDebit } from "@/lib/wallet/ledger";

export const runtime = "nodejs";

/**
 * Hubtel commission-services callback.
 * Pending pays (ResponseCode 0001) land here with the final state.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      ResponseCode?: string;
      Message?: string;
      Data?: {
        ClientReference?: string;
        TransactionId?: string;
        Token?: string;
        Status?: string;
      };
      ClientReference?: string;
      TransactionId?: string;
    };

    const reference =
      body.Data?.ClientReference || body.ClientReference || "";
    if (!reference) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const payment = await db.query.billPayments.findFirst({
      where: eq(billPayments.providerRef, reference),
    });
    const byTx = payment
      ? null
      : await db.query.transactions.findFirst({
          where: eq(transactions.externalRef, reference),
        });

    const tx = payment?.transactionId
      ? await db.query.transactions.findFirst({
          where: eq(transactions.id, payment.transactionId),
        })
      : byTx;

    const code = String(body.ResponseCode || body.Data?.Status || "");
    const success = code === "0000" || /success|completed|paid/i.test(code);
    const token = body.Data?.Token || null;
    const reason = body.Message || "Hubtel declined";

    if (success) {
      if (payment) {
        await db
          .update(billPayments)
          .set({
            status: "completed",
            tokenOrReceipt: token || payment.tokenOrReceipt,
            providerRef: body.Data?.TransactionId || payment.providerRef,
            failureReason: null,
            updatedAt: new Date(),
          })
          .where(eq(billPayments.id, payment.id));
      }
      if (tx && tx.status !== "completed") {
        await db
          .update(transactions)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(transactions.id, tx.id));
      }
      return NextResponse.json({ ok: true, settled: true });
    }

    if (tx) {
      if (tx.status === "completed") {
        await reverseCompletedDebit({
          walletId: tx.walletId,
          transactionId: tx.id,
          amount: Number(tx.amount),
          reason,
          userId: tx.userId,
        });
      } else if (tx.status !== "failed" && tx.status !== "reversed") {
        await refundFailedDebit({
          walletId: tx.walletId,
          transactionId: tx.id,
          amount: Number(tx.amount),
          reason,
          userId: tx.userId,
        });
      }
    }

    if (payment) {
      await db
        .update(billPayments)
        .set({
          status: tx?.status === "completed" ? "refunded" : "failed",
          tokenOrReceipt: token || payment.tokenOrReceipt,
          failureReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(billPayments.id, payment.id));
    }

    return NextResponse.json({ ok: true, refunded: true });
  } catch (error) {
    console.error("[hubtel-webhook]", error);
    return NextResponse.json({ ok: true });
  }
}
