import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  FALLBACK_EMAIL_DOMAINS,
  getHerosmsEmailDomains,
  isHerosmsDemoMode,
  normalizeEmailSite,
  usdToLocalPrice,
} from "@/lib/herosms";
import { currencyForCountry } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const site = normalizeEmailSite(searchParams.get("site") || "");
    if (!site) {
      return NextResponse.json(
        { error: "Select a site to load email domains" },
        { status: 400 },
      );
    }

    const currency = currencyForCountry(user.countryCode);
    const demo = isHerosmsDemoMode();
    let domains = FALLBACK_EMAIL_DOMAINS;

    if (!demo) {
      console.log("[herosms-email-domains] LIVE fetch", { site });
      const live = await getHerosmsEmailDomains(site);
      domains = live;
      console.log("[herosms-email-domains] LIVE ok", {
        site,
        count: domains.length,
      });
    } else {
      console.log("[herosms-email-domains] DEMO fallback domains", { site });
    }

    const list = [];
    for (const d of domains) {
      const costUsd = Number(d.cost) || 0.1;
      const domainName = String(d.name || "").toLowerCase();
      const { local } = await usdToLocalPrice(
        costUsd,
        user.countryCode,
        `email:${site}:${domainName}`,
      );
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
      site,
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
