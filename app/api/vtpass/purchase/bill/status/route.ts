import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { billPayments, transactions } from "@/lib/db/schema";

export const runtime = "nodejs";

/**
 * Poll Pairgate electricity bill settlement (token arrives via webhook).
 * GET /api/vtpass/purchase/bill/status?paymentId=… | ?transactionId=…
 */
export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");
    const transactionId = searchParams.get("transactionId");
    if (!paymentId && !transactionId) {
      return NextResponse.json(
        { error: "paymentId or transactionId is required" },
        { status: 400 },
      );
    }

    const payment = paymentId
      ? await db.query.billPayments.findFirst({
          where: eq(billPayments.id, paymentId),
        })
      : await db.query.billPayments.findFirst({
          where: eq(billPayments.transactionId, transactionId!),
        });

    if (!payment || payment.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tx = payment.transactionId
      ? await db.query.transactions.findFirst({
          where: eq(transactions.id, payment.transactionId),
        })
      : null;

    const meta = (tx?.metadata || {}) as Record<string, unknown>;
    const tokenFromMeta =
      typeof meta.token === "string" ? meta.token.trim() : null;

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      transactionId: payment.transactionId,
      status: payment.status,
      token: payment.tokenOrReceipt || tokenFromMeta || null,
      failureReason: payment.failureReason,
      requestId: payment.providerRef,
    });
  } catch (error) {
    console.error("[bill-status]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load bill status",
      },
      { status: 500 },
    );
  }
}
