import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { toTransactionReceipt } from "@/lib/transactions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const row = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    });

    if (!row) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      transaction: toTransactionReceipt(row),
    });
  } catch (error) {
    console.error("[transactions-id-get]", error);
    return NextResponse.json(
      { error: "Failed to load receipt" },
      { status: 500 },
    );
  }
}
