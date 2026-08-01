import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry } from "@/lib/wallet";
import {
  FALLBACK_COUNTRIES,
  getHerosmsPrices,
  herosmsErrorToEnglish,
  isHerosmsDemoMode,
  POPULAR_SERVICES,
  usdToLocalPrice,
  type HeroPriceOffer,
} from "@/lib/herosms";
import { resolveCountryIso, countryFlagUrl, countryFlagEmoji } from "@/lib/herosms/countries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service") || "ot";
    const countryParam = searchParams.get("country");
    const currency = currencyForCountry(user.countryCode);

    const serviceName =
      POPULAR_SERVICES.find((s) => s.code === service)?.name || service;

    if (isHerosmsDemoMode()) {
      console.log("[herosms-prices] DEMO catalog", { service, countryParam });
      const countries = countryParam
        ? FALLBACK_COUNTRIES.filter((c) => String(c.id) === countryParam)
        : FALLBACK_COUNTRIES;

      const offers: HeroPriceOffer[] = [];
      for (const c of countries) {
        const priceUsd = 0.12 + (c.id % 7) * 0.03;
        const { local } = await usdToLocalPrice(priceUsd, user.countryCode);
        offers.push({
          countryId: c.id,
          countryName: c.name,
          iso: c.iso,
          flagUrl: c.flagUrl,
          flagEmoji: c.flagEmoji,
          service,
          serviceName,
          priceUsd,
          priceLocal: local,
          currency,
          count: 50 + (c.id % 40),
        });
      }

      return NextResponse.json({
        ok: true,
        demo: true,
        service,
        serviceName,
        currency,
        offers,
      });
    }

    console.log("[herosms-prices] LIVE catalog", { service, countryParam });
    const prices = await getHerosmsPrices({
      service,
      ...(countryParam ? { country: Number(countryParam) } : {}),
    });

    const offers: HeroPriceOffer[] = [];

    for (const [countryId, value] of Object.entries(prices)) {
      const id = Number(countryId);
      if (!Number.isFinite(id)) continue;

      let cost = 0;
      let count = 0;

      if (value && typeof value === "object") {
        const row = value as Record<string, unknown>;
        // Shape A: { cost, count }
        if ("cost" in row) {
          cost = Number(row.cost) || 0;
          count = Number(row.count) || 0;
        } else if (service in row) {
          // Shape B: { [service]: { cost, count } }
          const nested = row[service] as Record<string, unknown> | undefined;
          cost = Number(nested?.cost) || 0;
          count = Number(nested?.count) || 0;
        } else {
          // Shape C: first nested service entry
          const first = Object.values(row)[0] as Record<string, unknown> | undefined;
          if (first && typeof first === "object") {
            cost = Number(first.cost) || 0;
            count = Number(first.count) || 0;
          }
        }
      }

      // Live: only show countries with stock
      if (cost <= 0 || count <= 0) continue;

      const fallback = FALLBACK_COUNTRIES.find((c) => c.id === id);
      const iso = resolveCountryIso(id, fallback?.name) || fallback?.iso || null;
      const name = fallback?.name || `Country ${id}`;
      const { local } = await usdToLocalPrice(cost, user.countryCode);

      offers.push({
        countryId: id,
        countryName: name,
        iso,
        flagUrl: iso ? countryFlagUrl(iso) : null,
        flagEmoji: iso ? countryFlagEmoji(iso) : "🏳️",
        service,
        serviceName,
        priceUsd: cost,
        priceLocal: local,
        currency,
        count,
      });
    }

    // Enrich names from live countries when possible (cached lightly via parallel call)
    try {
      const { getHerosmsCountries } = await import("@/lib/herosms");
      const live = await getHerosmsCountries();
      const byId = new Map(live.map((c) => [c.id, c]));
      for (const offer of offers) {
        const c = byId.get(offer.countryId);
        if (c) {
          offer.countryName = c.name;
          offer.iso = c.iso;
          offer.flagUrl = c.flagUrl;
          offer.flagEmoji = c.flagEmoji;
        }
      }
    } catch {
      // keep fallbacks
    }

    offers.sort((a, b) => a.priceLocal - b.priceLocal);
    console.log("[herosms-prices] LIVE offers", {
      service,
      count: offers.length,
    });

    return NextResponse.json({
      ok: true,
      demo: false,
      service,
      serviceName,
      currency,
      offers,
    });
  } catch (error) {
    console.error("[herosms-prices] LIVE failed", error);
    return NextResponse.json(
      {
        error: herosmsErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load prices",
        ),
      },
      { status: 400 },
    );
  }
}
