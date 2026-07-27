import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { quoteLocalUsd, roundMoney } from "@/lib/fx/rates";
import { currencyForCountry } from "@/lib/wallet";
import {
  FALLBACK_JAP_SERVICES,
  enrichJapService,
  filterJapServices,
  getJapServices,
  isJapDemoMode,
  japMarkup,
  japUsdCost,
} from "@/lib/jap";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform") || "All";
    const query = searchParams.get("q") || "";
    const currency = currencyForCountry(user.countryCode);

    const raw = isJapDemoMode()
      ? FALLBACK_JAP_SERVICES
      : await getJapServices();

    const enriched = raw.map(enrichJapService);
    const filtered = filterJapServices(enriched, { platform, query });

    const sliced =
      filtered.length > 250 && platform === "All" && !query.trim()
        ? filtered.slice(0, 250)
        : filtered.slice(0, 400);

    const quote = await quoteLocalUsd(currency);
    const markup = japMarkup();
    const toLocal = (usd: number) =>
      roundMoney(usd * quote.buyRate * markup);

    const services = sliced.map((s) => {
      const sampleQty = Math.min(Math.max(s.min, 1000), s.max);
      const priceUsd = japUsdCost(s.rate, sampleQty);
      return {
        service: s.service,
        name: s.name,
        type: s.type,
        category: s.category,
        platform: s.platform,
        metric: s.metric,
        rate: s.rate,
        min: s.min,
        max: s.max,
        refill: s.refill,
        cancel: s.cancel,
        currency,
        priceLocalPerThousand: toLocal(s.rate),
        sampleQuantity: sampleQty,
        samplePriceLocal: toLocal(priceUsd),
      };
    });

    const platforms = Array.from(
      new Set(enriched.map((s) => s.platform)),
    ).sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      ok: true,
      demo: isJapDemoMode(),
      currency,
      platforms: [
        "All",
        ...platforms.filter((p) => p !== "Other"),
        ...(platforms.includes("Other") ? (["Other"] as const) : []),
      ],
      total: enriched.length,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error("[jap-services]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load services",
      },
      { status: 400 },
    );
  }
}
