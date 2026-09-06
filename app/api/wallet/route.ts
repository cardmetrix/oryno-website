import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { loadWalletPayload } from "@/lib/wallet/load-payload";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "clerk_bearer_rejected",
        },
        { status: 401 },
      );
    }

    void import("@/lib/wallet/settle-user-pending")
      .then((m) =>
        m.settleUserPendingTransactions({ userId: user.id, limit: 15 }),
      )
      .catch((error) => {
        console.error("[wallet-settle-pending]", error);
      });

    const payload = await loadWalletPayload(user);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[wallet-get]", error);
    const message =
      error instanceof Error ? error.message : "Failed to load wallet";
    return NextResponse.json(
      {
        error: "Failed to load wallet",
        message,
      },
      { status: 500 },
    );
  }
}
