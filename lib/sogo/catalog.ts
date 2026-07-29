import type { GiftCardBrandView, SogoCatalogBrand } from "./types";

/** Domains used for open logo APIs (Clearbit / DuckDuckGo / Google). */
export const BRAND_LOGO_DOMAINS: Record<string, string> = {
  amazon: "amazon.com",
  apple: "apple.com",
  itunes: "apple.com",
  "google-play": "play.google.com",
  googleplay: "google.com",
  steam: "steampowered.com",
  playstation: "playstation.com",
  xbox: "xbox.com",
  roblox: "roblox.com",
  "razer-gold": "razer.com",
  razergold: "razer.com",
  netflix: "netflix.com",
  spotify: "spotify.com",
  sephora: "sephora.com",
  nike: "nike.com",
  walmart: "walmart.com",
  target: "target.com",
  "best-buy": "bestbuy.com",
  bestbuy: "bestbuy.com",
  ebay: "ebay.com",
  gamestop: "gamestop.com",
  "foot-locker": "footlocker.com",
  footlocker: "footlocker.com",
  nordstrom: "nordstrom.com",
  macys: "macys.com",
  lululemon: "lululemon.com",
  offgamers: "offgamers.com",
  visa: "visa.com",
  amex: "americanexpress.com",
  vanilla: "vanillagift.com",
  "green-dot": "greendot.com",
  greendot: "greendot.com",
  netspend: "netspend.com",
  "dicks-sporting": "dickssportinggoods.com",
  dickssportinggoods: "dickssportinggoods.com",
};

/** Local fallback art under /public/gift-cards */
const LOCAL_PNG = new Set([
  "amazon",
  "apple",
  "google-play",
  "steam",
  "playstation",
  "xbox",
  "netflix",
  "spotify",
]);

export function brandDomain(slug: string) {
  const key = slug.toLowerCase();
  if (BRAND_LOGO_DOMAINS[key]) return BRAND_LOGO_DOMAINS[key];
  return `${key.replace(/[^a-z0-9-]/g, "")}.com`;
}

/**
 * Prefer provider OpenAPI image fields, then open logo APIs, then local art.
 * Open APIs: Clearbit Logo API (public).
 */
export function giftCardImagePath(slug: string, providerImage?: string | null) {
  if (providerImage && /^https?:\/\//i.test(providerImage)) {
    return providerImage;
  }
  const domain = brandDomain(slug);
  return `https://logo.clearbit.com/${domain}?size=128`;
}

export function giftCardImageFallbacks(slug: string) {
  const domain = brandDomain(slug);
  const local = LOCAL_PNG.has(slug.toLowerCase())
    ? `/gift-cards/${slug.toLowerCase()}.png`
    : `/gift-cards/${slug.toLowerCase()}.svg`;
  return [
    `https://logo.clearbit.com/${domain}?size=128`,
    `https://icons.duckduckgo.com/ip3/${domain}.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
    local,
  ];
}

/** Pick image URL from raw OpenAPI / provider catalog objects. */
export function pickProviderImage(
  raw: Record<string, unknown> | null | undefined,
) {
  if (!raw) return null;
  const keys = [
    "image",
    "image_url",
    "imageUrl",
    "logo",
    "logo_url",
    "logoUrl",
    "icon",
    "icon_url",
    "iconUrl",
    "thumbnail",
    "thumbnail_url",
  ];
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string" && /^https?:\/\//i.test(v.trim())) {
      return v.trim();
    }
  }
  return null;
}

const CATEGORY_BY_SLUG: Record<string, string> = {
  amazon: "Shopping",
  apple: "Apps & Media",
  itunes: "Apps & Media",
  "google-play": "Apps & Games",
  googleplay: "Apps & Games",
  steam: "Gaming",
  playstation: "Gaming",
  xbox: "Gaming",
  roblox: "Gaming",
  "razer-gold": "Gaming",
  razergold: "Gaming",
  netflix: "Streaming",
  spotify: "Music",
  sephora: "Beauty",
  nike: "Fashion",
  walmart: "Shopping",
  target: "Shopping",
  "best-buy": "Shopping",
  bestbuy: "Shopping",
  ebay: "Shopping",
  gamestop: "Gaming",
  "foot-locker": "Fashion",
  footlocker: "Fashion",
  nordstrom: "Fashion",
  macys: "Fashion",
  lululemon: "Fashion",
  offgamers: "Gaming",
  visa: "Prepaid",
  amex: "Prepaid",
  vanilla: "Prepaid",
  "green-dot": "Prepaid",
  greendot: "Prepaid",
  netspend: "Prepaid",
  "dicks-sporting": "Shopping",
  dickssportinggoods: "Shopping",
};

export function categoryForSlug(slug: string, name?: string) {
  const key = slug.toLowerCase();
  if (CATEGORY_BY_SLUG[key]) return CATEGORY_BY_SLUG[key];
  const n = (name || slug).toLowerCase();
  if (/game|xbox|play|steam|roblox|razer/.test(n)) return "Gaming";
  if (/visa|amex|vanilla|prepaid|netspend|green/.test(n)) return "Prepaid";
  if (/spotify|music|itunes/.test(n)) return "Music";
  if (/netflix|hulu|disney|streaming/.test(n)) return "Streaming";
  if (/nike|adidas|sephora|lulu|fashion|locker|nordstrom|macy/.test(n))
    return "Fashion";
  return "Shopping";
}

/**
 * Static fallback catalogue when SOGO_SECRET_KEY is missing (demo mode)
 * or the provider is unreachable. Mirrors brands listed in Sogo docs.
 */
export const FALLBACK_GIFT_CARD_CATALOG: SogoCatalogBrand[] = [
  {
    slug: "amazon",
    name: "Amazon",
    currencies: ["USD", "GBP", "EUR", "CAD"],
    denominations: [10, 25, 50, 100, 200],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "apple",
    name: "Apple / iTunes",
    currencies: ["USD", "GBP", "EUR"],
    denominations: [10, 15, 25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "google-play",
    name: "Google Play",
    currencies: ["USD", "GBP", "EUR"],
    denominations: [10, 25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "steam",
    name: "Steam",
    currencies: ["USD", "GBP", "EUR"],
    denominations: [20, 50, 100],
    card_types: ["ecode"],
    is_active: true,
  },
  {
    slug: "playstation",
    name: "PlayStation",
    currencies: ["USD", "GBP", "EUR"],
    denominations: [10, 25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "xbox",
    name: "Xbox",
    currencies: ["USD", "GBP", "EUR"],
    denominations: [10, 25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "roblox",
    name: "Roblox",
    currencies: ["USD"],
    denominations: [10, 25, 50],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "razer-gold",
    name: "Razer Gold",
    currencies: ["USD"],
    denominations: [10, 25, 50, 100],
    card_types: ["ecode"],
    is_active: true,
  },
  {
    slug: "netflix",
    name: "Netflix",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode"],
    is_active: true,
  },
  {
    slug: "spotify",
    name: "Spotify",
    currencies: ["USD", "GBP", "EUR"],
    denominations: [10, 30, 60],
    card_types: ["ecode"],
    is_active: true,
  },
  {
    slug: "sephora",
    name: "Sephora",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "nike",
    name: "Nike",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "walmart",
    name: "Walmart",
    currencies: ["USD"],
    denominations: [25, 50, 100, 200],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "target",
    name: "Target",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "best-buy",
    name: "Best Buy",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "ebay",
    name: "eBay",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode"],
    is_active: true,
  },
  {
    slug: "gamestop",
    name: "GameStop",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "foot-locker",
    name: "Foot Locker",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "nordstrom",
    name: "Nordstrom",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "macys",
    name: "Macy's",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "lululemon",
    name: "lululemon",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
  {
    slug: "offgamers",
    name: "OffGamers",
    currencies: ["USD"],
    denominations: [10, 25, 50, 100],
    card_types: ["ecode"],
    is_active: true,
  },
  {
    slug: "visa",
    name: "Visa",
    currencies: ["USD"],
    denominations: [25, 50, 100, 200],
    card_types: ["physical"],
    is_active: true,
  },
  {
    slug: "amex",
    name: "Amex",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["physical"],
    is_active: true,
  },
  {
    slug: "vanilla",
    name: "Vanilla",
    currencies: ["USD"],
    denominations: [25, 50, 100, 200],
    card_types: ["physical"],
    is_active: true,
  },
  {
    slug: "green-dot",
    name: "Green Dot",
    currencies: ["USD"],
    denominations: [25, 50, 100, 200],
    card_types: ["physical"],
    is_active: true,
  },
  {
    slug: "netspend",
    name: "NetSpend",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["physical"],
    is_active: true,
  },
  {
    slug: "dicks-sporting",
    name: "Dick's Sporting",
    currencies: ["USD"],
    denominations: [25, 50, 100],
    card_types: ["ecode", "physical"],
    is_active: true,
  },
];

/** Demo NGN rates per $1 face value (ecode). */
export const FALLBACK_DEMO_RATES_NGN: Record<string, number> = {
  amazon: 1634,
  apple: 1580,
  "google-play": 1520,
  steam: 1490,
  playstation: 1470,
  xbox: 1470,
  roblox: 1400,
  "razer-gold": 1450,
  netflix: 1350,
  spotify: 1380,
  sephora: 1420,
  nike: 1400,
  walmart: 1500,
  target: 1480,
  "best-buy": 1460,
  ebay: 1440,
  gamestop: 1410,
  "foot-locker": 1390,
  nordstrom: 1380,
  macys: 1370,
  lululemon: 1360,
  offgamers: 1430,
  visa: 1320,
  amex: 1300,
  vanilla: 1280,
  "green-dot": 1260,
  netspend: 1250,
  "dicks-sporting": 1400,
};

export function normalizeCatalogBrand(
  raw: SogoCatalogBrand | Record<string, unknown>,
): SogoCatalogBrand {
  const row = raw as Record<string, unknown>;
  const slug = String(row.slug || "").toLowerCase();
  const providerImage = pickProviderImage(row);
  return {
    slug,
    name: String(row.name || slug),
    currencies: Array.isArray(row.currencies)
      ? (row.currencies as string[])
      : ["USD"],
    denominations: Array.isArray(row.denominations)
      ? (row.denominations as number[])
      : [10, 25, 50, 100],
    card_types: Array.isArray(row.card_types)
      ? (row.card_types as SogoCatalogBrand["card_types"])
      : ["ecode"],
    requires_pin: Boolean(row.requires_pin),
    is_active: row.is_active !== false,
    image: providerImage,
  };
}

export function toBrandView(brand: SogoCatalogBrand): GiftCardBrandView {
  const slug = brand.slug.toLowerCase();
  return {
    slug,
    name: brand.name,
    category: categoryForSlug(slug, brand.name),
    image: giftCardImagePath(slug, brand.image),
    currencies: brand.currencies?.length ? brand.currencies : ["USD"],
    denominations: brand.denominations?.length
      ? brand.denominations
      : [10, 25, 50, 100],
    cardTypes: brand.card_types?.length ? brand.card_types : ["ecode"],
    requiresPin: Boolean(brand.requires_pin),
    active: brand.is_active !== false,
  };
}
