import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
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

    const demo = isHerosmsDemoMode();
    console.log("[herosms-services]", demo ? "DEMO" : "LIVE");

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

    // Put popular codes first
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
      services,
    });
  } catch (error) {
    console.error("[herosms-services] LIVE failed", error);
    return NextResponse.json(
      {
        error: herosmsErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load services",
        ),
      },
      { status: 400 },
    );
  }
}
