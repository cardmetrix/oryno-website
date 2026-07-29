import type { GiftCardBrandView, SogoCatalogBrand } from "./types";

/** Local gift-card art under /public/gift-cards */
const PNG_BRANDS = new Set([
  "amazon",
  "apple",
  "google-play",
  "steam",
  "playstation",
  "xbox",
  "netflix",
  "spotify",
]);

export function giftCardImagePath(slug: string) {
  const key = slug.toLowerCase();
  if (PNG_BRANDS.has(key)) return `/gift-cards/${key}.png`;
  return `/gift-cards/${key}.svg`;
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

/** Domains used to fetch brand logos when generating local art */
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

/** Demo NGN rates per $1 face value (ecode). Physical slightly lower. */
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

export function toBrandView(brand: SogoCatalogBrand): GiftCardBrandView {
  const slug = brand.slug.toLowerCase();
  return {
    slug,
    name: brand.name,
    category: categoryForSlug(slug, brand.name),
    image: brand.image || giftCardImagePath(slug),
    currencies: brand.currencies?.length ? brand.currencies : ["USD"],
    denominations: brand.denominations?.length
      ? brand.denominations
      : [10, 25, 50, 100],
    cardTypes: brand.card_types?.length ? brand.card_types : ["ecode"],
    requiresPin: Boolean(brand.requires_pin),
    active: brand.is_active !== false,
  };
}
