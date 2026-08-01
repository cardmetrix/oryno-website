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
    const demo = isHerosmsDemoMode();
    let domains = FALLBACK_EMAIL_DOMAINS;

    if (!demo) {
      console.log("[herosms-email-domains] LIVE fetch");
      // Live mode: never serve fake fallback domains (purchase would 400).
      const live = await getHerosmsEmailDomains();
      domains = live.filter((d) => Boolean(d?.name?.trim()));
      console.log("[herosms-email-domains] LIVE ok", {
        count: domains.length,
      });
      if (!domains.length) {
        return NextResponse.json(
          {
            error:
              "No email domains available right now. Try again later.",
          },
          { status: 400 },
        );
      }
    } else {
      console.log("[herosms-email-domains] DEMO fallback domains");
    }

    const list = [];
    for (const d of domains) {
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
      demo,
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
