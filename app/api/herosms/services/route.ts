import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fivesimErrorToEnglish,
  isFivesimLive,
  listFivesimServices,
  numbersProvider,
} from "@/lib/fivesim";
import {
  getHerosmsServices,
  herosmsErrorToEnglish,
  isHerosmsDemoMode,
  POPULAR_SERVICES,
} from "@/lib/herosms";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const provider = numbersProvider();

    if (provider === "fivesim") {
      if (!isFivesimLive()) {
        return NextResponse.json(
          {
            error:
              "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
          },
          { status: 503 },
        );
      }
      const services = await listFivesimServices();
      return NextResponse.json({
        ok: true,
        demo: false,
        provider: "fivesim",
        services,
      });
    }

    const demo = isHerosmsDemoMode();
    console.log("[numbers-services]", demo ? "DEMO herosms" : "LIVE herosms");

    let services = demo ? POPULAR_SERVICES : await getHerosmsServices();
    if (!services.length) {
      if (!demo) {
        return NextResponse.json(
          { error: "No services available right now. Try again later." },
          { status: 400 },
        );
      }
      services = POPULAR_SERVICES;
    }

    const popularCodes = new Set(POPULAR_SERVICES.map((s) => s.code));
    services = [...services].sort((a, b) => {
      const ap = popularCodes.has(a.code) ? 0 : 1;
      const bp = popularCodes.has(b.code) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      ok: true,
      demo,
      provider: "herosms",
      services,
    });
  } catch (error) {
    console.error("[numbers-services]", error);
    const provider = numbersProvider();
    return NextResponse.json(
      {
        error:
          provider === "fivesim"
            ? fivesimErrorToEnglish(
                error instanceof Error ? error.message : "Failed to load services",
              )
            : herosmsErrorToEnglish(
                error instanceof Error ? error.message : "Failed to load services",
              ),
      },
      { status: 400 },
    );
  }
}
