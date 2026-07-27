import {
  countryFlagEmoji,
  countryFlagUrl,
  resolveCountryIso,
} from "./countries";

export type HeroCountry = {
  id: number;
  name: string;
  iso: string | null;
  flagUrl: string | null;
  flagEmoji: string;
  rent: boolean;
  visible: boolean;
};

export type HeroService = {
  code: string;
  name: string;
};

export type HeroPriceOffer = {
  countryId: number;
  countryName: string;
  iso: string | null;
  flagUrl: string | null;
  flagEmoji: string;
  service: string;
  serviceName: string;
  /** Cost in USD from HeroSMS */
  priceUsd: number;
  /** Cost in user wallet currency (after FX + markup) */
  priceLocal: number;
  currency: string;
  count: number;
};

/** Popular verification services shown first. */
export const POPULAR_SERVICES: HeroService[] = [
  { code: "wa", name: "WhatsApp" },
  { code: "tg", name: "Telegram" },
  { code: "go", name: "Google / Gmail" },
  { code: "ig", name: "Instagram" },
  { code: "fb", name: "Facebook" },
  { code: "lf", name: "TikTok" },
  { code: "tw", name: "Twitter / X" },
  { code: "ds", name: "Discord" },
  { code: "oi", name: "Tinder" },
  { code: "mm", name: "Microsoft" },
  { code: "am", name: "Amazon" },
  { code: "hw", name: "Alipay / 1688" },
  { code: "ot", name: "Any other" },
];

export const FALLBACK_EMAIL_DOMAINS = [
  { name: "gmail.com", cost: 0.15, count: 100 },
  { name: "outlook.com", cost: 0.12, count: 80 },
  { name: "mail.com", cost: 0.08, count: 120 },
  { name: "hotmail.com", cost: 0.12, count: 60 },
  { name: "yahoo.com", cost: 0.1, count: 50 },
  { name: "gmx.com", cost: 0.08, count: 90 },
];

/** Demo countries with logos when API key is missing. */
export const FALLBACK_COUNTRIES: HeroCountry[] = [
  { id: 19, name: "Nigeria", iso: "NG", flagUrl: countryFlagUrl("NG"), flagEmoji: "🇳🇬", rent: true, visible: true },
  { id: 38, name: "Ghana", iso: "GH", flagUrl: countryFlagUrl("GH"), flagEmoji: "🇬🇭", rent: true, visible: true },
  { id: 8, name: "Kenya", iso: "KE", flagUrl: countryFlagUrl("KE"), flagEmoji: "🇰🇪", rent: true, visible: true },
  { id: 31, name: "South Africa", iso: "ZA", flagUrl: countryFlagUrl("ZA"), flagEmoji: "🇿🇦", rent: true, visible: true },
  { id: 187, name: "USA", iso: "US", flagUrl: countryFlagUrl("US"), flagEmoji: "🇺🇸", rent: true, visible: true },
  { id: 16, name: "United Kingdom", iso: "GB", flagUrl: countryFlagUrl("GB"), flagEmoji: "🇬🇧", rent: true, visible: true },
  { id: 36, name: "Canada", iso: "CA", flagUrl: countryFlagUrl("CA"), flagEmoji: "🇨🇦", rent: true, visible: true },
  { id: 22, name: "India", iso: "IN", flagUrl: countryFlagUrl("IN"), flagEmoji: "🇮🇳", rent: true, visible: true },
  { id: 6, name: "Indonesia", iso: "ID", flagUrl: countryFlagUrl("ID"), flagEmoji: "🇮🇩", rent: true, visible: true },
  { id: 4, name: "Philippines", iso: "PH", flagUrl: countryFlagUrl("PH"), flagEmoji: "🇵🇭", rent: true, visible: true },
  { id: 73, name: "Brazil", iso: "BR", flagUrl: countryFlagUrl("BR"), flagEmoji: "🇧🇷", rent: true, visible: true },
  { id: 43, name: "Germany", iso: "DE", flagUrl: countryFlagUrl("DE"), flagEmoji: "🇩🇪", rent: true, visible: true },
  { id: 78, name: "France", iso: "FR", flagUrl: countryFlagUrl("FR"), flagEmoji: "🇫🇷", rent: true, visible: true },
  { id: 1, name: "Ukraine", iso: "UA", flagUrl: countryFlagUrl("UA"), flagEmoji: "🇺🇦", rent: true, visible: true },
  { id: 21, name: "Egypt", iso: "EG", flagUrl: countryFlagUrl("EG"), flagEmoji: "🇪🇬", rent: true, visible: true },
];

export function mapHeroCountry(raw: {
  id: number | string;
  eng?: string;
  rus?: string;
  visible?: number | string;
  rent?: number | string;
}): HeroCountry {
  const id = Number(raw.id);
  const name = raw.eng || raw.rus || `Country ${id}`;
  const iso = resolveCountryIso(id, name);
  return {
    id,
    name,
    iso,
    flagUrl: iso ? countryFlagUrl(iso) : null,
    flagEmoji: iso ? countryFlagEmoji(iso) : "🏳️",
    rent: Number(raw.rent) === 1,
    visible: Number(raw.visible) !== 0,
  };
}
