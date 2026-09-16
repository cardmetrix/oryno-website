import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fetchSogoSellCatalog,
  getSogoGiftCardsPartnerError,
  isSogoDemoMode,
  isSogoGiftCardsPartnerLive,
} from "@/lib/sogo";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const brands = await fetchSogoSellCatalog();
    const demo = isSogoDemoMode();
    const unavailable = !demo && !isSogoGiftCardsPartnerLive();
    const partnerError = getSogoGiftCardsPartnerError();
    return NextResponse.json({
      brands,
      demo,
      unavailable,
      partnerError: unavailable ? partnerError : null,
      source: unavailable ? "fallback" : demo ? "demo" : "provider",
    });
  } catch (error) {
    console.error("[sogo-catalog]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load gift cards",
      },
      { status: 400 },
    );
  }
}
