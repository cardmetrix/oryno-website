import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureVirtualCardsSchema } from "@/lib/db/ensure-schema";
import {
  requireTransactionPin,
  TransactionPinError,
} from "@/lib/security/transaction-pin";
import { revealVirtualCard } from "@/lib/virtual-cards";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    await ensureVirtualCardsSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { pin?: string };

    try {
      await requireTransactionPin(user.id, body.pin);
    } catch (error) {
      if (error instanceof TransactionPinError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      throw error;
    }

    const revealed = await revealVirtualCard({
      userId: user.id,
      cardId: id,
    });

    return NextResponse.json({
      ok: true,
      ...revealed,
      holderName: user.fullName,
    });
  } catch (error) {
    console.error("[virtual-card-reveal]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reveal card",
      },
      { status: 400 },
    );
  }
}
