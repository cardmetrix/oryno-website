import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { pollJapOrderStatus } from "@/lib/jap";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const data = await pollJapOrderStatus(id);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    console.error("[jap-status]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 400 },
    );
  }
}
