import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { billPayments, transactions } from "@/lib/db/schema";

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

    const code = String(body.ResponseCode || body.Data?.Status || "");
    const success = code === "0000" || /success|completed|paid/i.test(code);
    const status = success ? "completed" : "failed";
    const token = body.Data?.Token || null;

    if (payment) {
      await db
        .update(billPayments)
        .set({
          status,
          tokenOrReceipt: token || payment.tokenOrReceipt,
          providerRef: body.Data?.TransactionId || payment.providerRef,
          failureReason: success ? null : body.Message || "Hubtel declined",
          updatedAt: new Date(),
        })
        .where(eq(billPayments.id, payment.id));
      if (payment.transactionId) {
        await db
          .update(transactions)
          .set({
            status,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, payment.transactionId));
      }
    } else if (byTx) {
      await db
        .update(transactions)
        .set({ status, updatedAt: new Date() })
        .where(eq(transactions.id, byTx.id));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[hubtel-webhook]", error);
    return NextResponse.json({ ok: true });
  }
}
