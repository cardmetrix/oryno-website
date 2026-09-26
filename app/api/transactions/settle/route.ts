import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { scheduleUserBackgroundSettle } from "@/lib/wallet/background-settle";

export const runtime = "nodejs";

/** Queue pending-tx / boost sync (runs after response via `after()`). */
export async function POST() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    scheduleUserBackgroundSettle(user.id, "full");

    return NextResponse.json({
      ok: true,
      queued: true,
    });
  } catch (error) {
    console.error("[transactions-settle]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not settle pending transactions",
      },
      { status: 500 },
    );
  }
}
