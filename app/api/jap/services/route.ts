import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  adminUsdConversionRate,
  quoteLocalUsd,
} from "@/lib/fx/customer-quote";
import { currencyForCountry } from "@/lib/wallet";
import {
  enrichJapService,
  famsupPanelCurrency,
  filterJapServices,
  getJapServicesSafe,
  japUsdCost,
} from "@/lib/jap";
import { createUsdPricer, usdFromLocalRetail } from "@/lib/pricing/service-pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Cap packages per platform+metric so the full catalog stays small & fast. */
function diversifyJapCatalog<
  T extends { platform: string; metric: string; quality?: string; rate: number },
>(list: T[], perGroup = 8) {
  const sorted = [...list].sort((a, b) => a.rate - b.rate);
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const item of sorted) {
    const key = `${item.platform}::${item.metric}::${item.quality || "Standard"}`;
    const n = counts.get(key) ?? 0;
    if (n >= perGroup) continue;
    counts.set(key, n + 1);
    out.push(item);
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform") || "All";
    const query = searchParams.get("q") || "";
    const localCurrency = currencyForCountry(user.countryCode);

    const {
      services: raw,
      demo,
      fallback,
    } = await getJapServicesSafe();

    console.log("[jap-services]", demo ? "DEMO" : fallback ? "FALLBACK" : "LIVE", {
      platform,
      query,
      rawCount: raw.length,
    });

    const enriched = raw.map(enrichJapService);
    const filtered = filterJapServices(enriched, { platform, query });

    // Keep enough coverage for client-side platform/type filtering.
    // Prefer cheapest packages within each platform+metric group.
    const sliced =
      platform === "All" && !query.trim()
        ? diversifyJapCatalog(filtered, 12)
        : filtered
            .slice()
            .sort((a, b) => a.rate - b.rate)
            .slice(0, 400);

    const quote = await quoteLocalUsd(localCurrency);
    const panelCurrency = famsupPanelCurrency();
    const panelPerUsd =
      panelCurrency === "USD" || panelCurrency === "USDT"
        ? 1
        : await adminUsdConversionRate(panelCurrency);
    const priceUsd = await createUsdPricer("jap");

    const services = sliced.map((s) => {
      const sampleQty = Math.min(Math.max(s.min, 1000), s.max);
      const priceUsdSample = japUsdCost(s.rate, sampleQty);
      const key = String(s.service);
      const perThousand = priceUsd({
        serviceKey: key,
        usd: s.rate,
        buyRate: quote.buyRate,
      });
      const sample = priceUsd({
        serviceKey: key,
        usd: priceUsdSample,
        buyRate: quote.buyRate,
      });
      return {
        service: s.service,
        name: s.name,
        type: s.type,
        category: s.category,
        platform: s.platform,
        metric: s.metric,
        quality: s.quality,
        rate: s.rate,
        min: s.min,
        max: s.max,
        refill: s.refill,
        cancel: s.cancel,
        currency: "USD",
        priceUsdPerThousand: usdFromLocalRetail(perThousand.local, quote.buyRate),
        sampleQuantity: sampleQty,
        samplePriceUsd: usdFromLocalRetail(sample.local, quote.buyRate),
        priceLocalPerThousand: perThousand.local,
        samplePriceLocal: sample.local,
        listPriceLocal: sample.listLocal,
        priceOverride: sample.overrideApplied,
      };
    });

    const platforms = Array.from(
      new Set(enriched.map((s) => s.platform)),
    ).sort((a, b) => a.localeCompare(b));

    console.log("[jap-services] ok", {
      demo,
      fallback,
      total: enriched.length,
      count: services.length,
    });

    return NextResponse.json({
      ok: true,
      demo,
      fallback,
      currency: "USD",
      fx: quote,
      conversion: {
        currency: localCurrency,
        perUsd: quote.buyRate,
        panelCurrency,
        panelPerUsd,
      },
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
    console.error("[jap-services] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load services",
      },
      { status: 400 },
    );
  }
}
