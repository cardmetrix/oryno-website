import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  FALLBACK_EMAIL_DOMAINS,
  getHerosmsEmailDomains,
  isHerosmsDemoMode,
  usdToLocalPrice,
} from "@/lib/herosms";
import { currencyForCountry } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currency = currencyForCountry(user.countryCode);
    const domains = isHerosmsDemoMode()
      ? FALLBACK_EMAIL_DOMAINS
      : await getHerosmsEmailDomains();

    const list = [];
    for (const d of domains.length ? domains : FALLBACK_EMAIL_DOMAINS) {
      const costUsd = Number(d.cost) || 0.1;
      const { local } = await usdToLocalPrice(costUsd, user.countryCode);
      list.push({
        name: d.name,
        costUsd,
        costLocal: local,
        currency,
        count: Number(d.count) || 0,
      });
    }

    return NextResponse.json({
      ok: true,
      demo: isHerosmsDemoMode(),
      domains: list,
    });
  } catch (error) {
    console.error("[herosms-email-domains]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load domains",
      },
      { status: 400 },
    );
  }
}
