import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureVirtualCardsSchema } from "@/lib/db/ensure-schema";
import { verifyVirtualCardPurchase } from "@/lib/virtual-cards";

export const runtime = "nodejs";

/** Verify Flutterwave redirect and mark order paid (awaits admin review). */
export async function POST(req: Request) {
  try {
    await ensureVirtualCardsSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      reference?: string;
      transactionId?: string | number;
    };

    const result = await verifyVirtualCardPurchase({
      userId: user.id,
      reference: body.reference,
      transactionId: body.transactionId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[virtual-card-purchase-verify]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not verify card payment",
      },
      { status: 400 },
    );
  }
}
