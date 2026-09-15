import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
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

    if (isHerosmsDemoMode()) {
      return NextResponse.json(
        {
          error:
            "Email rental is not configured for live yet. Set HEROSMS_API_KEY and HEROSMS_DEMO=false on the server.",
          demo: true,
          domains: [],
        },
        { status: 503 },
      );
    }

    const live = await getHerosmsEmailDomains(site);
    if (!live.length) {
      return NextResponse.json({
        ok: true,
        demo: false,
        provider: "herosms",
        site,
        domains: [],
        message: "No domains in stock for that site right now. Try another site.",
      });
    }

    const list = [];
    for (const d of live) {
      const costUsd = Number(d.cost) || 0.1;
      const domainName = String(d.name || "").toLowerCase();
      const { local } = await usdToLocalPrice(
        costUsd,
        user.countryCode,
        `email:${site}:${domainName}`,
        "email",
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
      demo: false,
      provider: "herosms",
      site,
      domains: list,
    });
  } catch (error) {
    console.error("[email-domains]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load domains",
      },
      { status: 400 },
    );
  }
}
