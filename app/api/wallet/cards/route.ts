import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureVirtualCardsSchema } from "@/lib/db/ensure-schema";
import { getCardsPagePayload } from "@/lib/virtual-cards";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureVirtualCardsSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await getCardsPagePayload(user.id, user.fullName);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[virtual-cards-get]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load cards",
      },
      { status: 500 },
    );
  }
}
