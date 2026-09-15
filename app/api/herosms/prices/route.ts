import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { createUsdPricer, usdFromLocalRetail } from "@/lib/pricing/service-pricing";
import { currencyForCountry } from "@/lib/wallet";
import {
  fivesimErrorToEnglish,
  isFivesimLive,
  listFivesimOffers,
  numbersProvider,
} from "@/lib/fivesim";
import {
  FALLBACK_COUNTRIES,
  getHerosmsPrices,
  herosmsErrorToEnglish,
  isHerosmsDemoMode,
  POPULAR_SERVICES,
  type HeroPriceOffer,
} from "@/lib/herosms";
import {
  resolveCountryIso,
  countryFlagUrl,
  countryFlagEmoji,
} from "@/lib/herosms/countries";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service") || "whatsapp";
    const countryParam = searchParams.get("country");
    const provider = numbersProvider();

    if (provider === "fivesim") {
      if (!isFivesimLive()) {
        return NextResponse.json(
          {
            error:
              "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
          },
          { status: 503 },
        );
      }

      const { product, serviceName, offers, quote } = await listFivesimOffers({
        service,
        countryCode: countryParam,
        userCountryCode: user.countryCode,
      });

      return NextResponse.json({
        ok: true,
        demo: false,
        provider: "fivesim",
        service: product,
        serviceName,
        currency: "USD",
        fx: quote,
        offers,
      });
    }

    const localCurrency = currencyForCountry(user.countryCode);
    const quote = await quoteLocalUsd(localCurrency);
    const price = await createUsdPricer("herosms");

    const retailFor = (costUsd: number, serviceKey: string) => {
      const local = price({
        serviceKey,
        usd: costUsd,
        buyRate: quote.buyRate,
      });
      return {
        costUsd,
        priceUsd: usdFromLocalRetail(local.local, quote.buyRate),
        priceLocal: local.local,
      };
    };

    const serviceName =
      POPULAR_SERVICES.find((s) => s.code === service)?.name || service;

    if (isHerosmsDemoMode()) {
      const countries = countryParam
        ? FALLBACK_COUNTRIES.filter((c) => String(c.id) === countryParam)
        : FALLBACK_COUNTRIES;

      const offers: HeroPriceOffer[] = [];
      for (const c of countries) {
        const costUsd = 0.12 + (c.id % 7) * 0.03;
        const priced = retailFor(costUsd, `${c.id}:${service}`);
        offers.push({
          countryId: c.id,
          countryName: c.name,
          iso: c.iso,
          flagUrl: c.flagUrl,
          flagEmoji: c.flagEmoji,
          service,
          serviceName,
          ...priced,
          currency: "USD",
          count: 50 + (c.id % 40),
        });
      }

      return NextResponse.json({
        ok: true,
        demo: true,
        provider: "herosms",
        service,
        serviceName,
        currency: "USD",
        fx: quote,
        offers,
      });
    }

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
        if ("cost" in row) {
          cost = Number(row.cost) || 0;
          count = Number(row.count) || 0;
        } else if (service in row) {
          const nested = row[service] as Record<string, unknown> | undefined;
          cost = Number(nested?.cost) || 0;
          count = Number(nested?.count) || 0;
        } else {
          const first = Object.values(row)[0] as Record<string, unknown> | undefined;
          if (first && typeof first === "object") {
            cost = Number(first.cost) || 0;
            count = Number(first.count) || 0;
          }
        }
      }
      if (cost <= 0 || count <= 0) continue;

      const fallback = FALLBACK_COUNTRIES.find((c) => c.id === id);
      const iso = resolveCountryIso(id, fallback?.name) || fallback?.iso || null;
      const name = fallback?.name || `Country ${id}`;
      const priced = retailFor(cost, `${id}:${service}`);
      offers.push({
        countryId: id,
        countryName: name,
        iso,
        flagUrl: iso ? countryFlagUrl(iso) : null,
        flagEmoji: iso ? countryFlagEmoji(iso) : "🏳️",
        service,
        serviceName,
        ...priced,
        currency: "USD",
        count,
      });
    }

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

    offers.sort((a, b) => a.priceUsd - b.priceUsd);

    return NextResponse.json({
      ok: true,
      demo: false,
      provider: "herosms",
      service,
      serviceName,
      currency: "USD",
      fx: quote,
      offers,
    });
  } catch (error) {
    console.error("[numbers-prices]", error);
    const provider = numbersProvider();
    return NextResponse.json(
      {
        error:
          provider === "fivesim"
            ? fivesimErrorToEnglish(
                error instanceof Error ? error.message : "Failed to load prices",
              )
            : herosmsErrorToEnglish(
                error instanceof Error ? error.message : "Failed to load prices",
              ),
      },
      { status: 400 },
    );
  }
}
