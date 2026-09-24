import type { LucideIcon } from "lucide-react";
import {
  Activity,
  FileText,
  Phone,
  Smartphone,
  Trophy,
  TrendingUp,
  Tv,
  Wifi,
  Zap,
} from "lucide-react";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { getCountryInfo, type SupportedCountryCode } from "@/lib/country";
import { providersForBettingCountry } from "@/lib/betting/catalog";
import { activeCountryConfig } from "@/lib/services-catalog";

export type ServiceCategory =
  | "Popular"
  | "Telecom"
  | "Lifestyle"
  | "Utilities"
  | "Coming soon";

export type ServiceDirectoryItem = {
  id: string;
  href: string;
  label: string;
  shortDescription: string;
  longDescription: string;
  category: ServiceCategory;
  tags: string[];
  eta: string;
  accent: string;
  popular?: boolean;
  soon?: boolean;
  icon: LucideIcon | typeof GiftCardIcon;
  stats?: string;
};

const {
  currencySymbol,
  billProviders,
  virtualNumbers,
} = activeCountryConfig;

export const servicesDirectory: ServiceDirectoryItem[] = [
  {
    id: "airtime",
    href: "/services/airtime",
    label: "Airtime",
    shortDescription: "Top up any network instantly",
    longDescription:
      "Buy local airtime in Nigeria (MTN, Airtel, Glo, 9mobile) or international top-ups for your country.",
    category: "Telecom",
    tags: ["MTN", "Airtel", "Glo", "9mobile", "International"],
    eta: "Instant",
    accent: "#FF6A00",
    popular: true,
    icon: Smartphone,
    stats: "From ₦50",
  },
  {
    id: "data",
    href: "/services/data",
    label: "Data Bundles",
    shortDescription: "Daily, weekly & monthly plans",
    longDescription:
      "Live plans for MTN, Airtel, Glo, 9mobile, Smile, Spectranet and SME — or international data for your country.",
    category: "Telecom",
    tags: ["MTN", "Airtel", "Glo", "Smile", "SME"],
    eta: "Instant",
    accent: "#FF6A00",
    popular: true,
    icon: Wifi,
    stats: "All networks",
  },
  {
    id: "electricity",
    href: "/services/electricity",
    label: "Electricity",
    shortDescription: "Prepaid & postpaid discos",
    longDescription:
      "Buy electricity for IKEDC, EKEDC, AEDC, and all major discos. Verify your meter, pay from your wallet, and receive a token.",
    category: "Utilities",
    tags: ["IKEDC", "EKEDC", "AEDC", "Prepaid"],
    eta: "1–3 mins",
    accent: "#FF6A00",
    popular: true,
    icon: Zap,
    stats: "All discos",
  },
  {
    id: "bills",
    href: "/services/bills",
    label: "TV Bills",
    shortDescription: "DStv, GOtv & StarTimes",
    longDescription: `Pay ${billProviders
      .filter((p) => p.category === "TV")
      .slice(0, 3)
      .map((p) => p.name)
      .join(", ")} and other cable TV subscriptions from your wallet.`,
    category: "Utilities",
    tags: ["DStv", "GOtv", "StarTimes"],
    eta: "1–3 mins",
    accent: "#FF6A00",
    popular: true,
    icon: Tv,
    stats: "Cable TV",
  },
  {
    id: "betting",
    href: "/services/betting",
    label: "Betting",
    shortDescription: "Fund SportyBet, Bet9ja & more",
    longDescription:
      "Verify a betting account ID and credit local bookmakers from your ORYNO wallet.",
    category: "Utilities",
    tags: ["Bet9ja", "SportyBet", "1xBet", "BetKing", "MelBet"],
    eta: "Instant",
    accent: "#FF6A00",
    popular: true,
    icon: Trophy,
    stats: "16 bookmakers",
  },
  {
    id: "social",
    href: "/services/social",
    label: "Social Boost",
    shortDescription: "Followers, likes & views",
    longDescription:
      "Grow Instagram, TikTok, YouTube and more — live packages, wallet checkout, and order tracking.",
    category: "Lifestyle",
    tags: ["Instagram", "TikTok", "YouTube"],
    eta: "Starts soon after order",
    accent: "#FF6A00",
    popular: true,
    icon: TrendingUp,
    stats: "Live catalog",
  },
  {
    id: "virtual-numbers",
    href: "/services/virtual-numbers",
    label: "Virtual Numbers",
    shortDescription: "Get verification numbers worldwide",
    longDescription:
      "Get SMS verification numbers worldwide for WhatsApp, Telegram, and more — pay from your ORYNO wallet.",
    category: "Lifestyle",
    tags: ["Buy", "Rent", "SMS"],
    eta: "Ready in minutes",
    accent: "#FF6A00",
    icon: Phone,
    stats: `${virtualNumbers.length}+ offers`,
  },
  {
    id: "gift-cards-live",
    href: "/services/gift-cards/live",
    label: "Gift Card Live",
    shortDescription: "Browse cards to buy with USD",
    longDescription:
      "Browse live gift card products, then tap a brand to buy with your USD balance.",
    category: "Lifestyle",
    tags: ["Live", "Buy", "USD"],
    eta: "Live catalog",
    accent: "#FF6A00",
    popular: true,
    icon: Activity,
    stats: "Live board",
  },
  {
    id: "gift-cards",
    href: "/services/gift-cards",
    label: "Gift Cards",
    shortDescription: "Buy gift cards with USD",
    longDescription:
      "Purchase digital gift cards worldwide. Paid from your USD balance.",
    category: "Lifestyle",
    tags: ["Amazon", "Apple", "Steam"],
    eta: "Instant codes",
    accent: "#FF6A00",
    soon: false,
    icon: GiftCardIcon,
    stats: "50+ brands",
  },
  {
    id: "invoices",
    href: "/invoices",
    label: "Invoices",
    shortDescription: "Free invoice generator",
    longDescription:
      "Create professional invoices and share Flutterwave payment links. Free forever.",
    category: "Lifestyle",
    tags: ["Free", "Payment link"],
    eta: "Instant",
    accent: "#FF6A00",
    popular: true,
    icon: FileText,
    stats: "Powered by ORYNO",
  },
];

const BETTING_COPY: Record<
  SupportedCountryCode,
  { short: string; long: string; tags: string[] }
> = {
  NG: {
    short: "Fund SportyBet, Bet9ja & more",
    long: "Verify a betting account ID and credit Bet9ja, SportyBet, 1xBet, BetKing, MelBet and other Nigerian bookmakers from your ORYNO wallet.",
    tags: ["Bet9ja", "SportyBet", "1xBet", "BetKing", "MelBet"],
  },
  GH: {
    short: "Fund SportyBet, Betway & more",
    long: "Verify a betting account ID and credit SportyBet, Betway, Premier Bet, 1xBet and other Ghana bookmakers from your ORYNO wallet.",
    tags: ["SportyBet", "Betway", "Premier Bet", "1xBet", "MelBet"],
  },
  KE: {
    short: "Fund SportPesa, Betika & more",
    long: "Verify a betting account ID and credit SportPesa, Betika, Odibets, Betway and other Kenyan bookmakers from your ORYNO wallet.",
    tags: ["SportPesa", "Betika", "Odibets", "Betway", "1xBet"],
  },
  ZA: {
    short: "Fund Betway, Hollywoodbets & more",
    long: "Verify a betting account ID and credit Betway, Hollywoodbets, SuperSportBet and other South African bookmakers from your ORYNO wallet.",
    tags: ["Betway", "Hollywoodbets", "SuperSportBet", "Easybet"],
  },
};

export function getServicesDirectory(countryCode?: string | null) {
  const country = getCountryInfo(countryCode);
  const betting = BETTING_COPY[country.code];
  const bookies = providersForBettingCountry(country.code);
  return servicesDirectory.map((item) => {
    if (item.id === "airtime") {
      return {
        ...item,
        stats:
          country.code === "ZA"
            ? "From R10"
            : `From ${country.currencySymbol}50`,
        shortDescription:
          country.code === "ZA"
            ? "MTN, Vodacom, Cell C & Telkom"
            : item.shortDescription,
        longDescription:
          country.code === "NG"
            ? item.longDescription
            : country.code === "ZA"
              ? "Buy South Africa airtime for MTN, Vodacom, Cell C and Telkom from your wallet."
              : `Buy ${country.name} airtime for local networks from your wallet.`,
        tags:
          country.code === "ZA"
            ? ["MTN", "Vodacom", "Cell C", "Telkom"]
            : item.tags,
      };
    }
    if (item.id === "data" && country.code === "ZA") {
      return {
        ...item,
        shortDescription: "MTN, Vodacom, Cell C & Telkom",
        longDescription:
          "Buy South Africa data bundles for MTN, Vodacom, Cell C and Telkom from your wallet.",
        tags: ["MTN", "Vodacom", "Cell C", "Telkom"],
        stats: "VTpass",
      };
    }
    if (item.id === "data" && country.code === "KE") {
      return {
        ...item,
        shortDescription: "Safaricom, Airtel & Telkom Kenya",
        longDescription:
          "Buy Kenya mobile data bundles for Safaricom, Airtel and Telkom from your wallet.",
        tags: ["Safaricom", "Airtel", "Telkom"],
        stats: "Daily & monthly bundles",
      };
    }
    if (item.id === "data" && country.code === "GH") {
      return {
        ...item,
        shortDescription: "MTN, Telecel & AirtelTigo",
        longDescription:
          "Buy Ghana mobile data bundles for MTN, Telecel and AirtelTigo from your wallet.",
        tags: ["MTN", "Telecel", "AirtelTigo"],
        stats: "Daily & monthly bundles",
      };
    }
    if (item.id === "betting") {
      return {
        ...item,
        shortDescription: betting.short,
        longDescription: betting.long,
        tags: betting.tags,
        stats: `${bookies.length} bookmakers`,
      };
    }
    if (item.id === "bills") {
      if (country.code === "GH") {
        return {
          ...item,
          shortDescription: "DStv, GOtv & Ghana Water",
          longDescription:
            "Pay DStv Ghana, GOtv, and Ghana Water from your wallet.",
          tags: ["DStv", "GOtv", "Ghana Water"],
          stats: "Hubtel",
        };
      }
      if (country.code === "KE") {
        return {
          ...item,
          shortDescription: "DStv, GOtv & Nairobi Water",
          longDescription:
            "Pay DStv Kenya, GOtv, StarTimes, Zuku, and Nairobi Water from your wallet.",
          tags: ["DStv", "GOtv", "Nairobi Water", "Zuku"],
          stats: "Reloadly",
        };
      }
      if (country.code === "ZA") {
        return {
          ...item,
          shortDescription: "DStv, GOtv & Johannesburg Water",
          longDescription:
            "Pay DStv South Africa, GOtv, StarTimes, and Johannesburg Water from your wallet.",
          tags: ["DStv", "GOtv", "Johannesburg Water"],
          stats: "Reloadly",
        };
      }
    }
    if (item.id === "electricity") {
      if (country.code === "GH") {
        return {
          ...item,
          shortDescription: "ECG prepaid & postpaid",
          longDescription:
            "Buy ECG electricity (prepaid and postpaid) from your ORYNO wallet.",
          tags: ["ECG", "Prepaid", "Postpaid"],
          stats: "Hubtel",
        };
      }
      if (country.code === "KE") {
        return {
          ...item,
          shortDescription: "Kenya Power (KPLC)",
          longDescription:
            "Buy Kenya Power prepaid and postpaid electricity from your wallet.",
          tags: ["KPLC", "Prepaid", "Postpaid"],
          stats: "Reloadly",
        };
      }
      if (country.code === "ZA") {
        return {
          ...item,
          shortDescription: "Eskom & City Power",
          longDescription:
            "Buy Eskom and City Power electricity from your ORYNO wallet.",
          tags: ["Eskom", "City Power"],
          stats: "Reloadly",
        };
      }
    }
    if (item.id === "gift-cards") {
      return {
        ...item,
        shortDescription: "Buy digital gift cards with USD",
        longDescription: `Purchase digital gift cards worldwide. Paid from your USD balance.`,
      };
    }
    return item;
  });
}

export const serviceCategories: Array<ServiceCategory | "All"> = [
  "All",
  "Popular",
  "Telecom",
  "Lifestyle",
  "Utilities",
  "Coming soon",
];

export function filterServices(
  items: ServiceDirectoryItem[],
  opts: { query?: string; category?: string },
) {
  const q = (opts.query ?? "").trim().toLowerCase();
  const category = opts.category ?? "All";

  return items.filter((item) => {
    const matchesCategory =
      category === "All" ||
      (category === "Popular" && item.popular) ||
      item.category === category;

    const haystack = [
      item.label,
      item.shortDescription,
      item.longDescription,
      item.category,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = !q || haystack.includes(q);
    return matchesCategory && matchesQuery;
  });
}
