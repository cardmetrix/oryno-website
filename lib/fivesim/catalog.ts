import { countryFlagEmoji, countryFlagUrl } from "./flags";

export type FivesimService = {
  /** 5sim product slug (whatsapp, telegram, …) */
  code: string;
  name: string;
};

/** Popular services — codes are 5sim product names. */
export const FIVESIM_POPULAR_SERVICES: FivesimService[] = [
  { code: "whatsapp", name: "WhatsApp" },
  { code: "telegram", name: "Telegram" },
  { code: "google", name: "Google / Gmail" },
  { code: "instagram", name: "Instagram" },
  { code: "facebook", name: "Facebook" },
  { code: "tiktok", name: "TikTok" },
  { code: "twitter", name: "Twitter / X" },
  { code: "discord", name: "Discord" },
  { code: "tinder", name: "Tinder" },
  { code: "microsoft", name: "Microsoft" },
  { code: "amazon", name: "Amazon" },
  { code: "openai", name: "OpenAI / ChatGPT" },
  { code: "viber", name: "Viber" },
  { code: "other", name: "Any other" },
];

/** Email / mailbox signup products on 5sim (SMS OTP — not temp inboxes). */
export const FIVESIM_EMAIL_SERVICES: FivesimService[] = [
  { code: "google", name: "Google / Gmail" },
  { code: "hotmail", name: "Hotmail" },
  { code: "microsoft", name: "Microsoft / Outlook" },
  { code: "yahoo", name: "Yahoo Mail" },
  { code: "protonmail", name: "Proton Mail" },
];

/** Map legacy HeroSMS short codes → 5sim products. */
export const HEROSMS_TO_FIVESIM: Record<string, string> = {
  wa: "whatsapp",
  tg: "telegram",
  go: "google",
  ig: "instagram",
  fb: "facebook",
  lf: "tiktok",
  tw: "twitter",
  ds: "discord",
  oi: "tinder",
  mm: "microsoft",
  am: "amazon",
  hw: "1688",
  ot: "other",
};

export function resolveFivesimProduct(service: string) {
  const key = service.trim().toLowerCase();
  return HEROSMS_TO_FIVESIM[key] || key;
}

export type FivesimPriceOffer = {
  countryId: number;
  countrySlug: string;
  countryName: string;
  iso: string | null;
  flagUrl: string | null;
  flagEmoji: string;
  service: string;
  serviceName: string;
  operator: string;
  costUsd: number;
  priceUsd: number;
  priceLocal: number;
  currency: string;
  count: number;
};

/** Stable numeric id from country slug (for UI selection keys). */
export function countryIdFromSlug(slug: string) {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000_000;
}

export function enrichCountry(slug: string, name: string, iso: string | null) {
  const code = iso?.toUpperCase() || null;
  return {
    countrySlug: slug,
    countryName: name,
    iso: code,
    flagUrl: code ? countryFlagUrl(code) : null,
    flagEmoji: code ? countryFlagEmoji(code) : "🏳️",
    countryId: countryIdFromSlug(slug),
  };
}
