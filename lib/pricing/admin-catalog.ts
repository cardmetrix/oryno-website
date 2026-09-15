import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import {
  enrichJapService,
  filterJapServices,
  getJapServicesSafe,
  japUsdCost,
  JAP_PLATFORMS,
} from "@/lib/jap";
import {
  FIVESIM_EMAIL_SERVICES,
  FIVESIM_POPULAR_SERVICES,
  isFivesimDemoMode,
  listFivesimOffers,
} from "@/lib/fivesim";
import {
  fetchReloadlyCountries,
  fetchReloadlyProducts,
  isReloadlyDemoMode,
} from "@/lib/reloadly";
import {
  extractNgnRate,
  fetchSogoSellCatalog,
  fetchSogoSellRates,
  isSogoDemoMode,
} from "@/lib/sogo";
import {
  fallbackServicesFor,
  fallbackVariationsFor,
  getVtpassServices,
  getVtpassVariations,
  isVtpassDemoMode,
  type VtpassServiceCategory,
} from "@/lib/vtpass";
import {
  createUsdPricer,
  getOverrideFor,
  getSogoPayoutShare,
  priceLocalAmount,
  priceUsdToLocal,
} from "@/lib/pricing/service-pricing";
import type {
  PricingProvider,
  ServicePriceOverrideDto,
} from "@/lib/pricing/types";

export type CatalogFilterOption = {
  id: string;
  label: string;
};

export type AdminCatalogItem = {
  serviceKey: string;
  title: string;
  subtitle: string;
  details: string;
  currency: string;
  costUsd: number | null;
  costLocal: number | null;
  retailLocal: number;
  listLocal: number;
  override: ServicePriceOverrideDto | null;
  meta?: Record<string, unknown>;
};

export type AdminCatalogResponse = {
  ok: true;
  provider: PricingProvider;
  currency: string;
  filters: {
    /** Secondary pickers the UI should show */
    fields: Array<{
      key: string;
      label: string;
      options: CatalogFilterOption[];
      required?: boolean;
    }>;
    applied: Record<string, string>;
  };
  items: AdminCatalogItem[];
  demo: boolean;
  hint?: string;
};

const VTPASS_CATEGORIES: Array<{
  id: VtpassServiceCategory;
  label: string;
}> = [
  { id: "airtime", label: "Airtime" },
  { id: "data", label: "Data" },
  { id: "tv-subscription", label: "TV" },
  { id: "electricity-bill", label: "Electricity" },
];

const EMAIL_SITES: CatalogFilterOption[] = [
  { id: "google", label: "Google / Gmail" },
  { id: "hotmail", label: "Hotmail" },
  { id: "microsoft", label: "Microsoft / Outlook" },
  { id: "yahoo", label: "Yahoo Mail" },
  { id: "protonmail", label: "Proton Mail" },
];

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

async function withOverride(
  provider: PricingProvider,
  serviceKey: string,
  priced: { local: number; listLocal: number },
): Promise<Pick<AdminCatalogItem, "retailLocal" | "listLocal" | "override">> {
  const override = await getOverrideFor(provider, serviceKey);
  return {
    retailLocal: priced.local,
    listLocal: priced.listLocal,
    override,
  };
}

export async function loadAdminPricingCatalog(input: {
  provider: PricingProvider;
  params: Record<string, string | undefined>;
}): Promise<AdminCatalogResponse> {
  const currency = "NGN";
  const applied: Record<string, string> = {};

  if (input.provider === "jap") {
    const platform = input.params.platform || "All";
    const q = input.params.q || "";
    applied.platform = platform;
    if (q) applied.q = q;

    const { services: raw, demo, fallback } = await getJapServicesSafe();
    const enriched = raw.map(enrichJapService);
    const filtered = filterJapServices(enriched, { platform, query: q });
    const sliced =
      platform === "All" && !q.trim()
        ? diversifyJapCatalog(filtered, 10)
        : filtered
            .slice()
            .sort((a, b) => a.rate - b.rate)
            .slice(0, 300);

    const quote = await quoteLocalUsd(currency);
    const priceUsd = await createUsdPricer("jap");
    const items: AdminCatalogItem[] = [];
    for (const s of sliced) {
      const serviceKey = String(s.service);
      const sampleQty = Math.min(Math.max(s.min, 1000), s.max);
      const sampleUsd = japUsdCost(s.rate, sampleQty);
      const priced = priceUsd({
        serviceKey,
        usd: sampleUsd,
        buyRate: quote.buyRate,
      });
      const ov = await withOverride("jap", serviceKey, priced);
      items.push({
        serviceKey,
        title: s.name,
        subtitle: `${s.platform} · ${s.metric}${s.quality ? ` · ${s.quality}` : ""}`,
        details: `ID ${s.service} · rate $${s.rate}/1k · min ${s.min} · max ${s.max} · sample ${sampleQty}`,
        currency,
        costUsd: sampleUsd,
        costLocal: null,
        ...ov,
        meta: {
          service: s.service,
          rate: s.rate,
          min: s.min,
          max: s.max,
          sampleQty,
        },
      });
    }

    return {
      ok: true,
      provider: "jap",
      currency,
      filters: {
        fields: [
          {
            key: "platform",
            label: "Platform",
            options: JAP_PLATFORMS.map((p) => ({ id: p, label: p })),
          },
        ],
        applied,
      },
      items,
      demo: demo || fallback,
      hint: fallback
        ? "Live boost panel timed out — showing fallback packages until it recovers."
        : "Prices shown for a sample quantity (usually 1,000). Overrides apply per service ID.",
    };
  }

  if (input.provider === "herosms") {
    const channel = (input.params.channel || "numbers") as "numbers" | "emails";
    applied.channel = channel;

    const services =
      channel === "emails" ? FIVESIM_EMAIL_SERVICES : FIVESIM_POPULAR_SERVICES;
    const service =
      (channel === "emails"
        ? input.params.site || input.params.service
        : input.params.service) ||
      services[0]?.code ||
      "whatsapp";
    applied.service = service;
    if (channel === "emails") applied.site = service;

    const serviceName =
      services.find((s) => s.code === service)?.name || service;
    const demo = isFivesimDemoMode();
    const quote = await quoteLocalUsd(currency);
    const items: AdminCatalogItem[] = [];

    if (!demo) {
      const { offers } = await listFivesimOffers({ service });
      for (const offer of offers) {
        const serviceKey = `${offer.countrySlug}:${offer.service}`;
        const priced = await priceUsdToLocal({
          provider: "herosms",
          serviceKey,
          usd: offer.costUsd,
          buyRate: quote.buyRate,
          source: "virtual_number",
        });
        const ov = await withOverride("herosms", serviceKey, priced);
        items.push({
          serviceKey,
          title: `${offer.countryName} · ${serviceName}`,
          subtitle:
            channel === "emails"
              ? `Email signup SMS · ${service}`
              : `Virtual number · ${service}`,
          details: `${offer.countrySlug} · cost $${offer.costUsd} · stock ${offer.count}`,
          currency,
          costUsd: offer.costUsd,
          costLocal: null,
          ...ov,
          meta: {
            countrySlug: offer.countrySlug,
            service: offer.service,
            count: offer.count,
            flagEmoji: offer.flagEmoji,
            flagUrl: offer.flagUrl,
          },
        });
      }
      items.sort((a, b) => a.retailLocal - b.retailLocal);
    }

    return {
      ok: true,
      provider: "herosms",
      currency,
      filters: {
        fields: [
          {
            key: "channel",
            label: "Channel",
            options: [
              { id: "numbers", label: "Virtual numbers" },
              { id: "emails", label: "Email signup SMS" },
            ],
            required: true,
          },
          channel === "emails"
            ? {
                key: "site",
                label: "Mailbox",
                options: EMAIL_SITES,
                required: true,
              }
            : {
                key: "service",
                label: "App / service",
                options: services.map((s) => ({ id: s.code, label: s.name })),
                required: true,
              },
        ],
        applied,
      },
      items,
      demo,
      hint: demo
        ? "Set FIVESIM_API_KEY and FIVESIM_DEMO=false to load live 5sim prices."
        : "Live 5sim activation prices. Fund the 5sim wallet before customer purchases will succeed.",
    };
  }

  if (input.provider === "reloadly") {
    const countryCode = (input.params.countryCode || "US").toUpperCase();
    applied.countryCode = countryCode;
    const q = input.params.q || "";
    if (q) applied.q = q;

    let countryOptions: CatalogFilterOption[] = [
      { id: "US", label: "United States" },
      { id: "GB", label: "United Kingdom" },
      { id: "NG", label: "Nigeria" },
      { id: "GH", label: "Ghana" },
      { id: "KE", label: "Kenya" },
      { id: "ZA", label: "South Africa" },
    ];
    try {
      const countries = await fetchReloadlyCountries();
      if (countries?.length) {
        countryOptions = countries
          .slice(0, 80)
          .map((c) => ({
            id: c.isoName || c.currencyCode || "",
            label: c.name || c.isoName || "Country",
          }))
          .filter((c) => c.id);
      }
    } catch {
      // keep defaults
    }

    const products = await fetchReloadlyProducts({
      countryCode,
      productName: q || undefined,
    });
    const quote = await quoteLocalUsd(currency);
    const items: AdminCatalogItem[] = [];
    for (const p of products.slice(0, 200)) {
      const denoms = p.denominations?.length
        ? p.denominations
        : [p.minAmount || 10].filter((n) => Number(n) > 0);
      const unit = Number(denoms[0]) || 10;
      const mapped = p.senderPriceMap?.[String(unit)];
      const usdFace =
        Number.isFinite(mapped) && Number(mapped) > 0 ? Number(mapped) : unit;
      const serviceKey = String(p.productId);
      const priced = await priceUsdToLocal({
        provider: "reloadly",
        serviceKey,
        usd: usdFace,
        buyRate: quote.buyRate,
      });
      const ov = await withOverride("reloadly", serviceKey, priced);
      items.push({
        serviceKey,
        title: p.name || p.brandName || `Product ${p.productId}`,
        subtitle: `${p.brandName || "Gift card"} · ${p.countryCode || countryCode}`,
        details: `Product #${p.productId} · sample ${unit} ${p.recipientCurrency || ""} · face $${usdFace.toFixed(2)} · ${p.denominationType || "fixed"}`,
        currency,
        costUsd: usdFace,
        costLocal: null,
        ...ov,
        meta: {
          productId: p.productId,
          brandName: p.brandName,
          sampleUnit: unit,
          denominations: denoms.slice(0, 8),
        },
      });
    }

    return {
      ok: true,
      provider: "reloadly",
      currency,
      filters: {
        fields: [
          {
            key: "countryCode",
            label: "Country",
            options: countryOptions,
            required: true,
          },
        ],
        applied,
      },
      items,
      demo: isReloadlyDemoMode(),
      hint: "Retail shown for the first denomination of each product.",
    };
  }

  if (input.provider === "sogo") {
    const brands = await fetchSogoSellCatalog();
    const rates = await fetchSogoSellRates();
    const rateBySlug = new Map(rates.map((r) => [r.slug, r]));
    const share = await getSogoPayoutShare();
    const items: AdminCatalogItem[] = [];

    for (const brand of brands.slice(0, 200)) {
      const entry = rateBySlug.get(brand.slug);
      const rate =
        (entry
          ? extractNgnRate({
              entry,
              currency: "USD",
              cardType: "ecode",
            })
          : null) ?? null;
      const sampleFace = 100;
      const providerPayout =
        rate && rate > 0 ? Math.round(sampleFace * rate * 100) / 100 : 0;
      const serviceKey = brand.slug;
      const priced =
        providerPayout > 0
          ? await priceLocalAmount({
              provider: "sogo",
              serviceKey,
              amount: providerPayout,
            })
          : { local: 0, listLocal: 0, overrideApplied: false, markup: share };
      const ov = await withOverride("sogo", serviceKey, priced);
      items.push({
        serviceKey,
        title: brand.name,
        subtitle: `${brand.category || "Gift card"} · sell`,
        details:
          rate && rate > 0
            ? `₦${rate}/USD · sample $${sampleFace} → provider ₦${providerPayout} · payout share ${share}`
            : "Rate unavailable",
        currency,
        costUsd: sampleFace,
        costLocal: providerPayout || null,
        ...ov,
        meta: {
          slug: brand.slug,
          ratePerUnit: rate,
          sampleFace,
          payoutShare: share,
        },
      });
    }

    return {
      ok: true,
      provider: "sogo",
      currency,
      filters: { fields: [], applied },
      items,
      demo: isSogoDemoMode(),
      hint: "User payout for a $100 e-code sample. Overrides adjust payout per brand slug.",
    };
  }

  // Airtime / data / bills — live VTpass catalogue
  const identifier = (input.params.identifier ||
    "data") as VtpassServiceCategory;
  applied.identifier = identifier;

  const services = isVtpassDemoMode()
    ? fallbackServicesFor(identifier)
    : await getVtpassServices(identifier).catch(() =>
        fallbackServicesFor(identifier),
      );
  const filtered = services.filter((s) => s.serviceID !== "foreign-airtime");
  const serviceOptions = filtered.map((s) => ({
    id: s.serviceID,
    label: s.name,
  }));

  const serviceID =
    input.params.serviceID || serviceOptions[0]?.id || filtered[0]?.serviceID;
  if (serviceID) applied.serviceID = serviceID;

  if (!serviceID) {
    return {
      ok: true,
      provider: "vtpass",
      currency,
      filters: {
        fields: [
          {
            key: "identifier",
            label: "Category",
            options: VTPASS_CATEGORIES.map((c) => ({
              id: c.id,
              label: c.label,
            })),
            required: true,
          },
        ],
        applied,
      },
      items: [],
      demo: isVtpassDemoMode(),
      hint: "Select a category to load networks/providers.",
    };
  }

  const live = isVtpassDemoMode()
    ? {
        serviceName: serviceID,
        variations: fallbackVariationsFor(serviceID),
      }
    : await getVtpassVariations(serviceID).catch(() => ({
        serviceName: serviceID,
        variations: fallbackVariationsFor(serviceID),
      }));
  const variations = live.variations;
  const serviceName = live.serviceName || serviceID;

  const items: AdminCatalogItem[] = [];
  for (const v of variations) {
    const code = v.variation_code || v.name;
    const face = Number(v.charged_amount ?? v.variation_amount) || 0;
    const serviceKey = `${serviceID}:${code}`;
    const priced = await priceLocalAmount({
      provider: "vtpass",
      serviceKey,
      amount: face > 0 ? face : 0,
    });
    const display =
      face > 0
        ? priced
        : await priceLocalAmount({
            provider: "vtpass",
            serviceKey: `${serviceID}:open`,
            amount: 1000,
          });
    const keyForOverride = face > 0 ? serviceKey : `${serviceID}:open`;
    const ov = await withOverride("vtpass", keyForOverride, display);
    items.push({
      serviceKey: keyForOverride,
      title: v.name || code,
      subtitle: `${serviceName} · ${identifier}`,
      details:
        face > 0
          ? `Code ${code} · provider ₦${face} · ${String(v.fixedPrice || "").toLowerCase() === "yes" ? "fixed" : "variable"}`
          : `Code ${code} · open amount (sample ₦1,000 shown) · override key ${keyForOverride}`,
      currency,
      costUsd: null,
      costLocal: face > 0 ? face : 1000,
      ...ov,
      meta: {
        serviceID,
        variationCode: code,
        fixedPrice: v.fixedPrice,
        faceAmount: face,
      },
    });
  }

  return {
    ok: true,
    provider: "vtpass",
    currency,
    filters: {
      fields: [
        {
          key: "identifier",
          label: "Category",
          options: VTPASS_CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
          })),
          required: true,
        },
        {
          key: "serviceID",
          label: "Network / provider",
          options: serviceOptions,
          required: true,
        },
      ],
      applied,
    },
    items,
    demo: isVtpassDemoMode(),
    hint: "Nigeria airtime, data, and bills are fulfilled by VTpass.",
  };
}
