import type { BuyProductView, ReloadlyProduct } from "./types";

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
    logoUrls: ["https://logo.clearbit.com/amazon.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/apple.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/google.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/steampowered.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/netflix.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/spotify.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/xbox.com?size=128"],
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
    logoUrls: ["https://logo.clearbit.com/playstation.com?size=128"],
    brand: { brandId: 9, brandName: "PlayStation" },
    country: { isoName: "US", name: "United States", currencyCode: "USD" },
  },
];

export function toBuyProductView(p: ReloadlyProduct): BuyProductView {
  const map = p.fixedRecipientToSenderDenominationsMap || {};
  const dens =
    p.fixedRecipientDenominations?.filter((n) => Number.isFinite(n)) ?? [];
  const brandName = p.brand?.brandName || p.productName;
  const image =
    p.logoUrls?.[0] ||
    `https://logo.clearbit.com/${brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 24)}.com?size=128`;

  return {
    productId: p.productId,
    name: p.productName,
    brandName,
    countryCode: (p.country?.isoName || "US").toUpperCase(),
    image,
    denominationType: p.denominationType || "FIXED",
    recipientCurrency: p.recipientCurrencyCode || "USD",
    denominations: dens.length ? dens : [10, 25, 50, 100],
    minAmount: p.minRecipientDenomination ?? null,
    maxAmount: p.maxRecipientDenomination ?? null,
    senderPriceMap: Object.fromEntries(
      Object.entries(map).map(([k, v]) => [String(k), Number(v)]),
    ),
    redeemHint: p.redeemInstruction?.concise || null,
  };
}
