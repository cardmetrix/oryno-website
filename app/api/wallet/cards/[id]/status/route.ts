import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureVirtualCardsSchema } from "@/lib/db/ensure-schema";
import { setVirtualCardStatus } from "@/lib/virtual-cards";

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
    const body = (await req.json().catch(() => ({}))) as {
      status?: "active" | "frozen" | "terminated";
    };

    if (
      !body.status ||
      !["active", "frozen", "terminated"].includes(body.status)
    ) {
      return NextResponse.json(
        { error: "status must be active, frozen, or terminated" },
        { status: 400 },
      );
    }

    const card = await setVirtualCardStatus({
      userId: user.id,
      cardId: id,
      status: body.status,
    });

    return NextResponse.json({ ok: true, card });
  } catch (error) {
    console.error("[virtual-card-status]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update card",
      },
      { status: 400 },
    );
  }
}
