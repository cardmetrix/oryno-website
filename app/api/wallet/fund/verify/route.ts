import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { publicPaymentError } from "@/lib/flutterwave/errors";
import { verifyLocalWalletFund } from "@/lib/flutterwave/local-fund";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      reference?: string;
      tx_ref?: string;
      transactionId?: string | number;
      transaction_id?: string | number;
    };
    const reference = (body.reference || body.tx_ref || "").trim();
    const transactionId = body.transactionId ?? body.transaction_id;
    if (!reference && transactionId == null) {
      return NextResponse.json(
        { error: "Missing payment reference" },
        { status: 400 },
      );
    }

    const result = await verifyLocalWalletFund({
      userId: user.id,
      reference: reference || String(transactionId),
      transactionId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[wallet-fund-verify]", error);
    return NextResponse.json(
      {
        error: publicPaymentError(
          error instanceof Error ? error.message : "Failed to verify payment",
        ),
      },
      { status: 400 },
    );
  }
}
