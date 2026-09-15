import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  anymessageErrorToEnglish,
  getAnymessageEmailDomains,
  isAnymessageDemoMode,
  normalizeEmailSite,
} from "@/lib/anymessage";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { createUsdPricer, usdFromLocalRetail } from "@/lib/pricing/service-pricing";
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

    if (isAnymessageDemoMode()) {
      return NextResponse.json(
        {
          error:
            "Email rental is not configured for live yet. Set ANYMESSAGE_API_TOKEN and ANYMESSAGE_DEMO=false on the server.",
          demo: true,
          domains: [],
        },
        { status: 503 },
      );
    }

    const currency = currencyForCountry(user.countryCode);
    const quote = await quoteLocalUsd(currency);
    const price = await createUsdPricer("herosms", "email");

    const live = await getAnymessageEmailDomains(site);
    if (!live.length) {
      return NextResponse.json({
        ok: true,
        demo: false,
        provider: "anymessage",
        site,
        domains: [],
        message:
          "No domains in stock for that site right now. Try another site.",
      });
    }

    const list = live.map((d) => {
      const domainName = String(d.name || "").toLowerCase();
      const costUsd = Number(d.cost) || 0.05;
      const local = price({
        serviceKey: `email:${site}:${domainName}`,
        usd: costUsd,
        buyRate: quote.buyRate,
      });
      return {
        name: domainName,
        /** Wholesale from AnyMessage */
        costUsd,
        /** Retail charged to the customer (USD card) */
        priceUsd: usdFromLocalRetail(local.local, quote.buyRate),
        costLocal: local.local,
        currency: "USD",
        count: Number(d.count) || 0,
      };
    });

    return NextResponse.json({
      ok: true,
      demo: false,
      provider: "anymessage",
      site,
      domains: list,
    });
  } catch (error) {
    console.error("[email-domains]", error);
    return NextResponse.json(
      {
        error: anymessageErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load domains",
        ),
      },
      { status: 400 },
    );
  }
}
