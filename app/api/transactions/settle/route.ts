import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { settleUserPendingTransactions } from "@/lib/wallet/settle-user-pending";

export const runtime = "nodejs";

/** Resolve the current user's pending transactions older than 5 minutes. */
export async function POST() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await settleUserPendingTransactions({
      userId: user.id,
      limit: 15,
    });

    return NextResponse.json({
      ok: true,
      ...result,
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
