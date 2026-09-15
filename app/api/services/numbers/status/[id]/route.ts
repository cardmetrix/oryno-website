import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  cancelFivesimNumber,
  fivesimErrorToEnglish,
  isFivesimLive,
  pollFivesimNumberStatus,
} from "@/lib/fivesim";
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
    if (!isFivesimLive()) {
      return NextResponse.json(
        {
          error:
            "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
        },
        { status: 503 },
      );
    }

    const { id } = await ctx.params;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const status = await pollFivesimNumberStatus(id, user.id);
    return NextResponse.json({
      ok: true,
      ...status,
      data: {
        value: status.code,
        code: status.code,
        status: status.status,
      },
    });
  } catch (error) {
    console.error("[numbers-status]", error);
    return NextResponse.json(
      {
        error: publicServiceError(
          fivesimErrorToEnglish(
            error instanceof Error ? error.message : "Failed to get status",
          ),
        ),
      },
      { status: 400 },
    );
  }
}

/** Cancel unused 5sim activation — docs: GET /v1/user/cancel/$id */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isFivesimLive()) {
      return NextResponse.json(
        {
          error:
            "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
        },
        { status: 503 },
      );
    }

    const { id } = await ctx.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Missing activation id" }, { status: 400 });
    }

    await cancelFivesimNumber(id.trim());
    return NextResponse.json({
      ok: true,
      cancelled: true,
      activationId: id,
      provider: "fivesim",
    });
  } catch (error) {
    console.error("[numbers-cancel]", error);
    return NextResponse.json(
      {
        error: publicServiceError(
          fivesimErrorToEnglish(
            error instanceof Error ? error.message : "Could not cancel number",
          ),
        ),
      },
      { status: 400 },
    );
  }
}
