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

    let domains = FALLBACK_EMAIL_DOMAINS;
    let demo = isHerosmsDemoMode();

    if (!demo) {
      try {
        const live = await getHerosmsEmailDomains();
        if (live.length) {
          domains = live;
        } else {
          demo = true;
        }
      } catch (error) {
        // Never fail the page — serve fallback domains so rent email stays usable.
        console.error("[herosms-email-domains] live failed, using fallback", error);
        demo = true;
        domains = FALLBACK_EMAIL_DOMAINS;
      }
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
