import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  getHerosmsServices,
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

    let services = isHerosmsDemoMode()
      ? POPULAR_SERVICES
      : await getHerosmsServices();

    if (!services.length) services = POPULAR_SERVICES;

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
      demo: isHerosmsDemoMode(),
      services,
    });
  } catch (error) {
    console.error("[herosms-services]", error);
    return NextResponse.json({
      ok: true,
      demo: true,
      services: POPULAR_SERVICES,
    });
  }
}
