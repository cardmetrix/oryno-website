import { openLogoPrimary, openLogoUrls } from "@/lib/brand-logos";
import {
  resolveCountryCode,
  type SupportedCountryCode,
} from "@/lib/country";

export type BettingProvider = {
  serviceID: string;
  name: string;
  domain: string;
  image: string;
  imageFallbacks: string[];
  minAmount: number;
  maxAmount: number;
  popular?: boolean;
};

const MIN = 100;
const MAX = 500_000;

function bookie(
  serviceID: string,
  name: string,
  domain: string,
  popular = false,
): BettingProvider {
  const urls = openLogoUrls(domain);
  return {
    serviceID,
    name,
    domain,
    image: urls[0] || openLogoPrimary(name),
    imageFallbacks: urls.slice(1),
    minAmount: MIN,
    maxAmount: MAX,
    popular,
  };
}

/** Bookmakers VTU Africa (and similar NG aggregators) commonly fund. */
export const BETTING_PROVIDERS_NG: BettingProvider[] = [
  bookie("bet9ja", "Bet9ja", "bet9ja.com", true),
  bookie("sportybet", "SportyBet", "sportybet.com", true),
  bookie("1xbet", "1xBet", "1xbet.com", true),
  bookie("betking", "BetKing", "betking.com", true),
  bookie("melbet", "MelBet", "melbet.com", true),
  bookie("betway", "Betway", "betway.com"),
  bookie("nairabet", "NairaBet", "nairabet.com"),
  bookie("merrybet", "MerryBet", "merrybet.com"),
  bookie("naijabet", "NaijaBet", "naijabet.com"),
  bookie("bangbet", "BangBet", "bangbet.com"),
  bookie("livescorebet", "LiveScoreBet", "livescorebet.com"),
  bookie("cloudbet", "CloudBet", "cloudbet.com"),
  bookie("betbiga", "BetBiga", "betbiga.com"),
  bookie("paripesa", "Paripesa", "paripesa.com"),
  bookie("nairamillion", "Naira Million", "nairamillion.com"),
  bookie("mylottohub", "MyLottoHub", "mylottohub.com"),
];

export const BETTING_PROVIDERS_GH: BettingProvider[] = [
  bookie("sportybet", "SportyBet", "sportybet.com.gh", true),
  bookie("betway", "Betway", "betway.com.gh", true),
  bookie("premierbet", "Premier Bet", "premierbet.com.gh", true),
  bookie("1xbet", "1xBet", "1xbet.com"),
  bookie("melbet", "MelBet", "melbet.com"),
  bookie("soccerbet", "Soccerbet", "soccerbet.com.gh"),
  bookie("betika", "Betika", "betika.com.gh"),
];

export const BETTING_PROVIDERS_KE: BettingProvider[] = [
  bookie("sportpesa", "SportPesa", "sportpesa.com", true),
  bookie("betika", "Betika", "betika.com", true),
  bookie("odibets", "Odibets", "odibets.com", true),
  bookie("betway", "Betway", "betway.co.ke"),
  bookie("1xbet", "1xBet", "1xbet.com"),
  bookie("mozzart", "Mozzart Bet", "mozzartbet.co.ke"),
  bookie("premierbet", "Premier Bet", "premierbet.co.ke"),
];

export const BETTING_PROVIDERS_ZA: BettingProvider[] = [
  bookie("betway", "Betway", "betway.co.za", true),
  bookie("hollywoodbets", "Hollywoodbets", "hollywoodbets.net", true),
  bookie("supersportbet", "SuperSportBet", "supersportbet.com", true),
  bookie("easybet", "Easybet", "easybet.co.za"),
  bookie("gbets", "Gbets", "gbets.co.za"),
  bookie("10bet", "10bet", "10bet.co.za"),
];

export const BETTING_PROVIDERS_BY_COUNTRY: Record<
  SupportedCountryCode,
  BettingProvider[]
> = {
  NG: BETTING_PROVIDERS_NG,
  GH: BETTING_PROVIDERS_GH,
  KE: BETTING_PROVIDERS_KE,
  ZA: BETTING_PROVIDERS_ZA,
};

/** @deprecated Use providersForBettingCountry — kept as the Nigeria catalog. */
export const BETTING_PROVIDERS = BETTING_PROVIDERS_NG;

export const BETTING_AMOUNT_PRESETS_BY_COUNTRY: Record<
  SupportedCountryCode,
  string[]
> = {
  NG: ["500", "1000", "2000", "5000", "10000"],
  GH: ["20", "50", "100", "200", "500"],
  KE: ["200", "500", "1000", "2000", "5000"],
  ZA: ["50", "100", "200", "500", "1000"],
};

export const BETTING_AMOUNT_PRESETS = BETTING_AMOUNT_PRESETS_BY_COUNTRY.NG;

export const DEMO_BETTING_CUSTOMERS = [
  {
    customerId: "12345678",
    name: "Adaobi Okafor",
    outcome: "success" as const,
    note: "Happy-path verify + fund",
  },
  {
    customerId: "87654321",
    name: "Chinedu Eze",
    outcome: "success" as const,
    note: "Second demo bettor",
  },
  {
    customerId: "10000001",
    name: "Sporty Demo User",
    outcome: "success" as const,
    note: "SportyBet-style account ID",
  },
  {
    customerId: "00000000",
    name: null,
    outcome: "verify_fail" as const,
    note: "Verification rejected",
  },
  {
    customerId: "99999999",
    name: "Failing Demo Account",
    outcome: "fund_fail" as const,
    note: "Verifies, then funding fails and wallet is refunded",
  },
] as const;

export function providersForBettingCountry(countryCode?: string | null) {
  return BETTING_PROVIDERS_BY_COUNTRY[resolveCountryCode(countryCode)];
}

export function presetsForBettingCountry(countryCode?: string | null) {
  return BETTING_AMOUNT_PRESETS_BY_COUNTRY[resolveCountryCode(countryCode)];
}

export function findBettingProvider(
  serviceID: string,
  countryCode?: string | null,
) {
  const key = serviceID.trim().toLowerCase();
  if (countryCode) {
    return (
      providersForBettingCountry(countryCode).find(
        (p) => p.serviceID === key,
      ) ?? null
    );
  }
  for (const list of Object.values(BETTING_PROVIDERS_BY_COUNTRY)) {
    const found = list.find((p) => p.serviceID === key);
    if (found) return found;
  }
  return null;
}

export function normalizeBettingCustomerId(raw: string) {
  return raw.replace(/\s+/g, "").trim();
}
