import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fetchReloadlyCountries,
  isReloadlyDemoMode,
  isReloadlySandbox,
  reloadlyErrorToEnglish,
} from "@/lib/reloadly";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[reloadly-countries]", {
      demo: isReloadlyDemoMode(),
      sandbox: isReloadlySandbox(),
    });

    const countries = await fetchReloadlyCountries();

    return NextResponse.json({
      ok: true,
      demo: isReloadlyDemoMode(),
      sandbox: isReloadlySandbox(),
      count: countries.length,
      countries: countries.map((c) => ({
        code: c.isoName,
        label: c.name,
        currency: c.currencyCode,
        flagUrl: c.flagUrl,
      })),
    });
  } catch (error) {
    console.error("[reloadly-countries] failed", error);
    return NextResponse.json(
      {
        error: reloadlyErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load countries",
        ),
      },
      { status: 400 },
    );
  }
}
