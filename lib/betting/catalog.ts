export type BettingProvider = {
  serviceID: string;
  name: string;
  domain: string;
  image: string;
  minAmount: number;
  maxAmount: number;
  popular?: boolean;
};

const MIN = 100;
const MAX = 500_000;

function logo(domain: string) {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
}

/** Bookmakers VTU Africa (and similar NG aggregators) commonly fund. */
export const BETTING_PROVIDERS: BettingProvider[] = [
  {
    serviceID: "bet9ja",
    name: "Bet9ja",
    domain: "bet9ja.com",
    image: logo("bet9ja.com"),
    minAmount: MIN,
    maxAmount: MAX,
    popular: true,
  },
  {
    serviceID: "sportybet",
    name: "SportyBet",
    domain: "sportybet.com",
    image: logo("sportybet.com"),
    minAmount: MIN,
    maxAmount: MAX,
    popular: true,
  },
  {
    serviceID: "1xbet",
    name: "1xBet",
    domain: "1xbet.com",
    image: logo("1xbet.com"),
    minAmount: MIN,
    maxAmount: MAX,
    popular: true,
  },
  {
    serviceID: "betking",
    name: "BetKing",
    domain: "betking.com",
    image: logo("betking.com"),
    minAmount: MIN,
    maxAmount: MAX,
    popular: true,
  },
  {
    serviceID: "melbet",
    name: "MelBet",
    domain: "melbet.com",
    image: logo("melbet.com"),
    minAmount: MIN,
    maxAmount: MAX,
    popular: true,
  },
  {
    serviceID: "betway",
    name: "Betway",
    domain: "betway.com",
    image: logo("betway.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "nairabet",
    name: "NairaBet",
    domain: "nairabet.com",
    image: logo("nairabet.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "merrybet",
    name: "MerryBet",
    domain: "merrybet.com",
    image: logo("merrybet.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "naijabet",
    name: "NaijaBet",
    domain: "naijabet.com",
    image: logo("naijabet.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "bangbet",
    name: "BangBet",
    domain: "bangbet.com",
    image: logo("bangbet.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "livescorebet",
    name: "LiveScoreBet",
    domain: "livescorebet.com",
    image: logo("livescorebet.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "cloudbet",
    name: "CloudBet",
    domain: "cloudbet.com",
    image: logo("cloudbet.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "betbiga",
    name: "BetBiga",
    domain: "betbiga.com",
    image: logo("betbiga.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "paripesa",
    name: "Paripesa",
    domain: "paripesa.com",
    image: logo("paripesa.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "nairamillion",
    name: "Naira Million",
    domain: "nairamillion.com",
    image: logo("nairamillion.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
  {
    serviceID: "mylottohub",
    name: "MyLottoHub",
    domain: "mylottohub.com",
    image: logo("mylottohub.com"),
    minAmount: MIN,
    maxAmount: MAX,
  },
];

export const BETTING_AMOUNT_PRESETS = ["500", "1000", "2000", "5000", "10000"];

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

export function findBettingProvider(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return BETTING_PROVIDERS.find((p) => p.serviceID === key) ?? null;
}

export function normalizeBettingCustomerId(raw: string) {
  return raw.replace(/\s+/g, "").trim();
}
