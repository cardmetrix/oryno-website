import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { pollNumberStatus } from "@/lib/herosms";

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
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const status = await pollNumberStatus(id, user.id);
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    console.error("[herosms-number-status]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 400 },
    );
  }
}
