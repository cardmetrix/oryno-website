import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

/** Phase 1: gift-card selling is disabled. */
export async function POST(_req: Request) {
  void _req;
  const user = await ensureAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(
    {
      error:
        "Gift card selling is not available in this version. You can buy gift cards with your USD balance.",
      code: "gift_card_sell_disabled",
    },
    { status: 410 },
  );
}
