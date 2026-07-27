import type { LucideIcon } from "lucide-react";
import {
  Mail,
  Phone,
  Smartphone,
  TrendingUp,
  Wifi,
  Zap,
} from "lucide-react";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
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
  emailRentals,
} = activeCountryConfig;

export const servicesDirectory: ServiceDirectoryItem[] = [
  {
    id: "airtime",
    href: "/services/airtime",
    label: "Airtime",
    shortDescription: "Top up any network instantly",
    longDescription:
      "Buy local airtime in Nigeria (MTN, Airtel, Glo, 9mobile) or international top-ups for your country via VTpass.",
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
      "Live VTpass plans for MTN, Airtel, Glo, 9mobile, Smile, Spectranet and SME — or international data for your country.",
    category: "Telecom",
    tags: ["MTN", "Airtel", "Glo", "Smile", "SME"],
    eta: "Instant",
    accent: "#FF8C42",
    popular: true,
    icon: Wifi,
    stats: "All VTpass plans",
  },
  {
    id: "bills",
    href: "/services/bills",
    label: "Bill Payments",
    shortDescription: "TV & electricity",
    longDescription: `Pay ${billProviders
      .filter((p) => p.category === "TV")
      .slice(0, 3)
      .map((p) => p.name)
      .join(", ")} plus all electricity discos with wallet balance via VTpass.`,
    category: "Utilities",
    tags: ["DStv", "GOtv", "IKEDC", "EKEDC"],
    eta: "1–3 mins",
    accent: "#E85D00",
    popular: true,
    icon: Zap,
    stats: `${billProviders.length}+ providers`,
  },
  {
    id: "social",
    href: "/services/social",
    label: "Social Boost",
    shortDescription: "Followers, likes & views",
    longDescription:
      "Grow Instagram, TikTok, YouTube and more via JustAnotherPanel — live services, wallet checkout, and order tracking.",
    category: "Lifestyle",
    tags: ["Instagram", "TikTok", "YouTube", "JAP"],
    eta: "Provider ETA",
    accent: "#C44D00",
    popular: true,
    icon: TrendingUp,
    stats: `Live JAP catalog`,
  },
  {
    id: "virtual-numbers",
    href: "/services/virtual-numbers",
    label: "Virtual Numbers",
    shortDescription: "Buy or rent SMS lines",
    longDescription:
      "Get verification numbers worldwide — buy permanently or rent short-term for OTP SMS.",
    category: "Lifestyle",
    tags: ["Buy", "Rent", "SMS"],
    eta: "Ready in minutes",
    accent: "#9A3A00",
    icon: Phone,
    stats: `${virtualNumbers.length}+ offers`,
  },
  {
    id: "emails",
    href: "/services/emails",
    label: "Rent Email",
    shortDescription: "Temporary inboxes for OTP",
    longDescription:
      "Rent HeroSMS temporary emails for sign-ups and verification — pick a duration and grab codes from your inbox.",
    category: "Lifestyle",
    tags: ["Rent", "OTP", "HeroSMS"],
    eta: "Instant inbox",
    accent: "#7A2E00",
    popular: true,
    icon: Mail,
    stats: `${emailRentals.length} rentals`,
  },
  {
    id: "gift-cards",
    href: "/services/gift-cards",
    label: "Gift Cards",
    shortDescription: "Buy & sell — coming soon",
    longDescription:
      "Trade popular gift cards at transparent rates. Join the waitlist while we finish launch.",
    category: "Coming soon",
    tags: ["Apple", "Amazon", "Steam"],
    eta: "Soon",
    accent: "#FF6A00",
    soon: true,
    icon: GiftCardIcon,
    stats: `${currencySymbol} rates live soon`,
  },
];

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
