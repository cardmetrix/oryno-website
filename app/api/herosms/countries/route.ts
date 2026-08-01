import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  FALLBACK_COUNTRIES,
  getHerosmsCountries,
  isHerosmsDemoMode,
} from "@/lib/herosms";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const demo = isHerosmsDemoMode();
    console.log("[herosms-countries]", demo ? "DEMO" : "LIVE");

    let countries = demo ? FALLBACK_COUNTRIES : await getHerosmsCountries();

    if (!countries.length) {
      console.warn("[herosms-countries] empty — using fallback");
      countries = FALLBACK_COUNTRIES;
    }

    // Prefer countries that have flags; keep all but sort flagged first
    countries = [...countries].sort((a, b) => {
      if (Boolean(a.flagUrl) !== Boolean(b.flagUrl)) {
        return a.flagUrl ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      ok: true,
      demo,
      countries,
    });
  } catch (error) {
    console.error("[herosms-countries] LIVE failed — demo fallback", error);
    return NextResponse.json({
      ok: true,
      demo: true,
      countries: FALLBACK_COUNTRIES,
      warning:
        error instanceof Error ? error.message : "Using fallback countries",
    });
  }
}
