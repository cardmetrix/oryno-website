import { appPublicOrigin } from "@/lib/admin/onboarding";

export type LandingAssetSlot =
  | "auth_panel"
  | "hero_home"
  | "hero_wallet"
  | "gallery_home"
  | "gallery_wallet"
  | "gallery_gift_cards"
  | "gallery_gift_cards_live"
  | "gallery_data"
  | "gallery_bills"
  | "gallery_virtual_numbers";

export type LandingAssetGroup = "auth" | "landing";

export type LandingAssetDefinition = {
  slot: LandingAssetSlot;
  label: string;
  description: string;
  defaultPath: string;
  group: LandingAssetGroup;
  sortOrder: number;
  /** Landing gallery metadata */
  galleryLabel?: string;
  galleryAlt?: string;
  galleryFile?: string;
};

export const LANDING_ASSET_SLOTS: LandingAssetDefinition[] = [
  {
    slot: "auth_panel",
    label: "Login / Auth panel",
    description: "Full-bleed image on the left side of login, register, and related auth screens.",
    defaultPath: "/brand/auth-panel.jpg",
    group: "auth",
    sortOrder: 0,
  },
  {
    slot: "hero_home",
    label: "Landing hero · Home phone",
    description: "Front phone mockup in the landing hero.",
    defaultPath: "/screenshots/home.png",
    group: "landing",
    sortOrder: 10,
  },
  {
    slot: "hero_wallet",
    label: "Landing hero · Wallet phone",
    description: "Back phone in the hero and the wallet section mockup.",
    defaultPath: "/screenshots/wallet.png",
    group: "landing",
    sortOrder: 20,
  },
  {
    slot: "gallery_home",
    label: "Gallery · Home",
    description: "Screenshots section — Home.",
    defaultPath: "/screenshots/home.png",
    group: "landing",
    sortOrder: 30,
    galleryLabel: "Home",
    galleryAlt: "ORYNO home dashboard with wallet balance and quick actions",
    galleryFile: "home.png",
  },
  {
    slot: "gallery_wallet",
    label: "Gallery · Wallet",
    description: "Screenshots section — Wallet.",
    defaultPath: "/screenshots/wallet.png",
    group: "landing",
    sortOrder: 40,
    galleryLabel: "Wallet",
    galleryAlt: "ORYNO wallet with NGN balance and bank accounts",
    galleryFile: "wallet.png",
  },
  {
    slot: "gallery_gift_cards",
    label: "Gallery · Gift Cards",
    description: "Screenshots section — Gift Cards.",
    defaultPath: "/screenshots/gift-cards.png",
    group: "landing",
    sortOrder: 50,
    galleryLabel: "Gift Cards",
    galleryAlt: "ORYNO gift card sell screen with live Amazon rates",
    galleryFile: "gift-cards.png",
  },
  {
    slot: "gallery_gift_cards_live",
    label: "Gallery · Live Rates",
    description: "Screenshots section — Live Rates.",
    defaultPath: "/screenshots/gift-cards-live.png",
    group: "landing",
    sortOrder: 60,
    galleryLabel: "Live Rates",
    galleryAlt: "ORYNO gift card live sell rates list",
    galleryFile: "gift-cards-live.png",
  },
  {
    slot: "gallery_data",
    label: "Gallery · Buy Data",
    description: "Screenshots section — Data.",
    defaultPath: "/screenshots/data.png",
    group: "landing",
    sortOrder: 70,
    galleryLabel: "Buy Data",
    galleryAlt: "ORYNO buy data plans with network selection",
    galleryFile: "data.png",
  },
  {
    slot: "gallery_bills",
    label: "Gallery · Bill Payments",
    description: "Screenshots section — Bills.",
    defaultPath: "/screenshots/bills.png",
    group: "landing",
    sortOrder: 80,
    galleryLabel: "Bill Payments",
    galleryAlt: "ORYNO bill payments for TV subscriptions",
    galleryFile: "bills.png",
  },
  {
    slot: "gallery_virtual_numbers",
    label: "Gallery · Virtual Numbers",
    description: "Screenshots section — Virtual Numbers.",
    defaultPath: "/screenshots/virtual-numbers.png",
    group: "landing",
    sortOrder: 90,
    galleryLabel: "Virtual Numbers",
    galleryAlt: "ORYNO virtual numbers for SMS verification",
    galleryFile: "virtual-numbers.png",
  },
];

export function isLandingAssetSlot(value: string): value is LandingAssetSlot {
  return LANDING_ASSET_SLOTS.some((s) => s.slot === value);
}

export function getLandingAssetDef(slot: string) {
  return LANDING_ASSET_SLOTS.find((s) => s.slot === slot) ?? null;
}

export function absoluteLandingAssetUrl(imagePath: string) {
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const path = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${appPublicOrigin()}${path}`;
}

/** Prefer a relative public path when the URL points at this app’s origin. */
export function publicLandingAssetUrl(imageUrl: string, fallbackPath: string) {
  const trimmed = String(imageUrl || "").trim();
  if (!trimmed) return fallbackPath;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    const origin = appPublicOrigin();
    if (url.origin === origin || url.hostname.includes("orynoafrica.com")) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    // keep remote UploadThing / CDN URLs as-is
  }
  return trimmed;
}

export function shapeLandingAsset(row: {
  id: string;
  slot: string;
  label: string;
  description: string | null;
  imageUrl: string;
  defaultPath: string;
  group: string;
  sortOrder: number;
  updatedAt: Date;
  createdAt: Date;
}) {
  const def = getLandingAssetDef(row.slot);
  const displayUrl = publicLandingAssetUrl(row.imageUrl, row.defaultPath);
  const defaultUrl = publicLandingAssetUrl(row.defaultPath, row.defaultPath);
  const isDefault =
    displayUrl === defaultUrl ||
    displayUrl === row.defaultPath ||
    displayUrl.endsWith(row.defaultPath);
  return {
    id: row.id,
    slot: row.slot,
    label: row.label,
    description: row.description,
    imageUrl: displayUrl,
    imageUrlAbsolute: absoluteLandingAssetUrl(displayUrl),
    defaultPath: row.defaultPath,
    defaultUrl,
    group: row.group,
    sortOrder: row.sortOrder,
    isCustom: !isDefault,
    galleryLabel: def?.galleryLabel ?? null,
    galleryAlt: def?.galleryAlt ?? null,
    galleryFile: def?.galleryFile ?? null,
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export type LandingAssetMap = Partial<Record<LandingAssetSlot, string>>;
