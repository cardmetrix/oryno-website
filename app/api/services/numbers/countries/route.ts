import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fivesimErrorToEnglish,
  getFivesimCountries,
  isFivesimLive,
} from "@/lib/fivesim";
import { enrichCountry } from "@/lib/fivesim/catalog";

export const runtime = "nodejs";

export async function GET() {
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

    const countries = (await getFivesimCountries()).map((c) => ({
      ...enrichCountry(c.slug, c.name, c.iso),
      id: c.slug,
    }));

    return NextResponse.json({
      ok: true,
      demo: false,
      provider: "fivesim",
      countries,
    });
  } catch (error) {
    console.error("[numbers-countries]", error);
    return NextResponse.json(
      {
        error: fivesimErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load countries",
        ),
      },
      { status: 400 },
    );
  }
}
