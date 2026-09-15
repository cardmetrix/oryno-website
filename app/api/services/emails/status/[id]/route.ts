import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  cancelEmail,
  herosmsErrorToEnglish,
  isHerosmsDemoMode,
  pollEmailStatus,
} from "@/lib/herosms";
import { publicServiceError } from "@/lib/service-errors";

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

    const status = await pollEmailStatus(id, user.id);
    return NextResponse.json({ ok: true, demo: false, data: status });
  } catch (error) {
    console.error("[rent-email-status]", error);
    return NextResponse.json(
      {
        error: publicServiceError(
          herosmsErrorToEnglish(
            error instanceof Error ? error.message : "Failed to get status",
          ),
        ),
      },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (isHerosmsDemoMode()) {
      return NextResponse.json(
        {
          error:
            "Email rental is not configured for live. Set HEROSMS_API_KEY and HEROSMS_DEMO=false.",
        },
        { status: 503 },
      );
    }

    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Missing email id" }, { status: 400 });
    }

    await cancelEmail(id.trim());
    return NextResponse.json({ ok: true, cancelled: true, emailId: id });
  } catch (error) {
    console.error("[rent-email-cancel]", error);
    return NextResponse.json(
      {
        error: publicServiceError(
          herosmsErrorToEnglish(
            error instanceof Error ? error.message : "Could not cancel email",
          ),
        ),
      },
      { status: 400 },
    );
  }
}
