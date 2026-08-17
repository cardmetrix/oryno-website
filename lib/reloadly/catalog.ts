import type { BuyProductView, ReloadlyProduct } from "./types";
import {
  brandDomain,
  giftCardImageFallbacks,
  giftCardImagePath,
  isUsableGiftCardImage,
} from "@/lib/sogo/catalog";

/** Map common Reloadly brand names → domains for open logo APIs */
const BUY_BRAND_DOMAINS: Record<string, string> = {
  amazon: "amazon.com",
  apple: "apple.com",
  itunes: "apple.com",
  "google play": "google.com",
  googleplay: "google.com",
  steam: "steampowered.com",
  netflix: "netflix.com",
  spotify: "spotify.com",
  xbox: "xbox.com",
  playstation: "playstation.com",
  roblox: "roblox.com",
  nike: "nike.com",
  sephora: "sephora.com",
  walmart: "walmart.com",
  target: "target.com",
  ebay: "ebay.com",
  visa: "visa.com",
  "american express": "americanexpress.com",
  amex: "americanexpress.com",
  "foot locker": "footlocker.com",
  vanilla: "vanillagift.com",
  netspend: "netspend.com",
  "dick's sporting": "dickssportinggoods.com",
  "dicks sporting": "dickssportinggoods.com",
};

export function buyBrandDomain(brandName: string) {
  const key = brandName.toLowerCase().trim();
  if (BUY_BRAND_DOMAINS[key]) return BUY_BRAND_DOMAINS[key];
  for (const [name, domain] of Object.entries(BUY_BRAND_DOMAINS)) {
    if (key.includes(name)) return domain;
  }
  return brandDomain(
    key.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "gift",
  );
}

/** Prefer Reloadly logoUrls, else local art / public favicons. */
export function buyProductImage(
  product: Pick<ReloadlyProduct, "logoUrls" | "brand" | "productName">,
) {
  const providerLogo = product.logoUrls?.find((u) => isUsableGiftCardImage(u));
  if (providerLogo) return providerLogo;

  const brandName = product.brand?.brandName || product.productName || "gift";
  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return giftCardImagePath(slug);
}

export function buyProductImageFallbacks(
  product: Pick<ReloadlyProduct, "logoUrls" | "brand" | "productName">,
) {
  const brandName = product.brand?.brandName || product.productName || "gift";
  const domain = buyBrandDomain(brandName);
  const slug = brandName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const provider = product.logoUrls?.filter((u) => isUsableGiftCardImage(u)) ?? [];
  return [
    ...provider,
    ...giftCardImageFallbacks(slug),
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
  ];
}

export const DEMO_RELOADLY_PRODUCTS: ReloadlyProduct[] = [
  {
    productId: 5,
    productName: "Amazon US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [10, 25, 50, 100],
    fixedRecipientToSenderDenominationsMap: {
      "10": 10,
      "25": 25,
      "50": 50,
      "100": 100,
    },
    logoUrls: ["/gift-cards/amazon.png"],
    brand: { brandId: 2, brandName: "Amazon" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
    redeemInstruction: {
      concise: "Redeem at amazon.com",
    },
  },
  {
    productId: 12,
    productName: "Apple / iTunes US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [10, 15, 25, 50, 100],
    fixedRecipientToSenderDenominationsMap: {
      "10": 10,
      "15": 15,
      "25": 25,
      "50": 50,
      "100": 100,
    },
    logoUrls: ["/gift-cards/apple.png"],
    brand: { brandId: 3, brandName: "Apple" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
  {
    productId: 20,
    productName: "Google Play US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [10, 25, 50, 100],
    fixedRecipientToSenderDenominationsMap: {
      "10": 10,
      "25": 25,
      "50": 50,
      "100": 100,
    },
    logoUrls: ["/gift-cards/google-play.png"],
    brand: { brandId: 4, brandName: "Google Play" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
  {
    productId: 30,
    productName: "Steam Wallet USD",
    global: true,
    status: "ACTIVE",
    denominationType: "RANGE",
    recipientCurrencyCode: "USD",
    minRecipientDenomination: 5,
    maxRecipientDenomination: 100,
    logoUrls: ["/gift-cards/steam.png"],
    brand: { brandId: 5, brandName: "Steam" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
  {
    productId: 40,
    productName: "Netflix US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [25, 50, 100],
    fixedRecipientToSenderDenominationsMap: {
      "25": 25,
      "50": 50,
      "100": 100,
    },
    logoUrls: ["/gift-cards/netflix.png"],
    brand: { brandId: 6, brandName: "Netflix" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
  {
    productId: 50,
    productName: "Spotify US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [10, 30, 60],
    fixedRecipientToSenderDenominationsMap: {
      "10": 10,
      "30": 30,
      "60": 60,
    },
    logoUrls: ["/gift-cards/spotify.png"],
    brand: { brandId: 7, brandName: "Spotify" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
  {
    productId: 60,
    productName: "Xbox US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [15, 25, 50, 100],
    fixedRecipientToSenderDenominationsMap: {
      "15": 15,
      "25": 25,
      "50": 50,
      "100": 100,
    },
    logoUrls: ["/gift-cards/xbox.png"],
    brand: { brandId: 8, brandName: "Xbox" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
  {
    productId: 70,
    productName: "PlayStation Store US",
    global: false,
    status: "ACTIVE",
    denominationType: "FIXED",
    recipientCurrencyCode: "USD",
    fixedRecipientDenominations: [10, 25, 50, 100],
    fixedRecipientToSenderDenominationsMap: {
      "10": 10,
      "25": 25,
      "50": 50,
      "100": 100,
    },
    logoUrls: ["/gift-cards/playstation.png"],
    brand: { brandId: 9, brandName: "PlayStation" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
];

export function toBuyProductView(p: ReloadlyProduct): BuyProductView {
  const map = p.fixedRecipientToSenderDenominationsMap || {};
  const dens = (p.fixedRecipientDenominations ?? [])
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice()
    .sort((a, b) => a - b);
  const brandName = p.brand?.brandName || p.productName;
  const type = (p.denominationType || "FIXED").toUpperCase();
  const isRange = type === "RANGE";

  // FIXED with no dens is unusual — leave empty so UI shows free amount / error.
  // RANGE uses min/max instead of fake denomination chips.
  return {
    productId: p.productId,
    name: p.productName,
    brandName,
    countryCode: (p.country?.isoName || "US").toUpperCase(),
    image: buyProductImage(p),
    imageFallbacks: buyProductImageFallbacks(p),
    denominationType: p.denominationType || "FIXED",
    recipientCurrency: p.recipientCurrencyCode || "USD",
    denominations: dens,
    minAmount:
      p.minRecipientDenomination ??
      (dens.length ? dens[0] : isRange ? 1 : null),
    maxAmount:
      p.maxRecipientDenomination ??
      (dens.length ? dens[dens.length - 1] : null),
    senderPriceMap: Object.fromEntries(
      Object.entries(map).map(([k, v]) => [String(k), Number(v)]),
    ),
    redeemHint: p.redeemInstruction?.concise || null,
  };
}
