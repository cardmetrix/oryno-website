import { AD_STATUS_OPTIONS, type AdStatus } from "@/lib/admin/ads";

export const ONBOARDING_STATUS_OPTIONS = AD_STATUS_OPTIONS;

export type OnboardingStatus = AdStatus;

export const DEFAULT_ONBOARDING_ACCENT = "#FF6A00";

export const DEFAULT_ONBOARDING_SLIDES = [
  {
    key: "wallet",
    title: "Your borderless wallet",
    subtitle:
      "Fund, convert, and spend across Africa with live multi-currency balances.",
    imagePath: "/onboarding/wallet.png",
    accent: "#FF6A00",
    sortOrder: 0,
  },
  {
    key: "gift",
    title: "Buy & sell gift cards",
    subtitle:
      "Trade Amazon, Apple, Steam, and more with live rates credited to your wallet.",
    imagePath: "/onboarding/gift-cards.png",
    accent: "#FF8C42",
    sortOrder: 1,
  },
  {
    key: "data",
    title: "Airtime & data",
    subtitle:
      "Top up MTN, Airtel, Glo, T2 and buy data bundles in seconds.",
    imagePath: "/onboarding/data.png",
    accent: "#FF6A00",
    sortOrder: 2,
  },
  {
    key: "bills",
    title: "Pay bills instantly",
    subtitle: "Electricity, DStv, GOtv, Startimes — all from one secure app.",
    imagePath: "/onboarding/bills.png",
    accent: "#E85D00",
    sortOrder: 3,
  },
  {
    key: "numbers",
    title: "Numbers & boost",
    subtitle:
      "Virtual numbers and social media boosting — ready when you are.",
    imagePath: "/onboarding/virtual-numbers.png",
    accent: "#FF8124",
    sortOrder: 4,
  },
] as const;

export function isOnboardingStatus(value: string): value is OnboardingStatus {
  return ONBOARDING_STATUS_OPTIONS.some((o) => o.value === value);
}

export function onboardingStatusLabel(status: string) {
  return (
    ONBOARDING_STATUS_OPTIONS.find((o) => o.value === status)?.label ||
    status.charAt(0).toUpperCase() + status.slice(1)
  );
}

export function normalizeAccent(raw?: string | null) {
  const value = String(raw || "").trim();
  if (!value) return DEFAULT_ONBOARDING_ACCENT;
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
    return value;
  }
  return DEFAULT_ONBOARDING_ACCENT;
}

export function appPublicOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.orynoafrica.com";
  try {
    const url = new URL(raw);
    if (url.hostname === "orynoafrica.com") {
      url.hostname = "www.orynoafrica.com";
    }
    return url.origin;
  } catch {
    return "https://www.orynoafrica.com";
  }
}

export function absoluteOnboardingImageUrl(imagePath: string) {
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${appPublicOrigin()}${path}`;
}

export function shapeOnboardingSlide(row: {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  accent: string | null;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.imageUrl,
    accent: row.accent || DEFAULT_ONBOARDING_ACCENT,
    status: row.status,
    statusLabel: onboardingStatusLabel(row.status),
    sortOrder: row.sortOrder,
    active: row.status === "live",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
