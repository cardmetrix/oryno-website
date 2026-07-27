import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { pollEmailStatus } from "@/lib/herosms";

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

    const status = await pollEmailStatus(id);
    return NextResponse.json({ ok: true, data: status });
  } catch (error) {
    console.error("[herosms-email-status]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get status",
      },
      { status: 400 },
    );
  }
}
