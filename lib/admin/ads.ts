import { servicesDirectory } from "@/lib/services-directory";

export const AD_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", description: "Hidden from users" },
  { value: "live", label: "Live", description: "Shown in the carousel" },
  { value: "paused", label: "Paused", description: "Temporarily hidden" },
  { value: "archived", label: "Archived", description: "Kept but not shown" },
] as const;

export type AdStatus = (typeof AD_STATUS_OPTIONS)[number]["value"];

export const AD_PLACEMENT_OPTIONS = [
  { value: "home_carousel", label: "Home carousel" },
  {
    value: "services_carousel",
    label: "Services carousel",
    description: "Shown under the services list (max 3 live)",
    maxLive: 3,
  },
  { value: "promo_banner", label: "Promo banner" },
] as const;

export type AdPlacement = (typeof AD_PLACEMENT_OPTIONS)[number]["value"];

/** Live-ad caps per placement. Undefined = no hard limit. */
export function maxLiveAdsForPlacement(placement: AdPlacement): number | null {
  const opt = AD_PLACEMENT_OPTIONS.find((o) => o.value === placement);
  if (opt && "maxLive" in opt && typeof opt.maxLive === "number") {
    return opt.maxLive;
  }
  return null;
}

export function adPlacementLabel(placement: string) {
  return (
    AD_PLACEMENT_OPTIONS.find((o) => o.value === placement)?.label ||
    placement
  );
}

/** Preset destinations for ad links — services + common app screens. */
export const AD_SERVICE_LINK_OPTIONS = [
  { id: "custom", label: "Custom URL (enter manually)", href: "" },
  { id: "dashboard", label: "Home / Dashboard", href: "/dashboard" },
  { id: "wallet", label: "Wallet", href: "/wallet" },
  { id: "fund", label: "Fund wallet", href: "/fund" },
  { id: "withdraw", label: "Withdraw", href: "/withdraw" },
  { id: "services", label: "All services", href: "/services" },
  ...servicesDirectory.map((s) => ({
    id: s.id,
    label: s.label,
    href: s.href,
  })),
] as const;

export type AdServiceLinkId = (typeof AD_SERVICE_LINK_OPTIONS)[number]["id"];

export function findAdServiceLinkByHref(href: string) {
  const normalized = href.trim();
  return AD_SERVICE_LINK_OPTIONS.find(
    (opt) => opt.id !== "custom" && opt.href === normalized,
  );
}

/** Accept in-app paths (`/…`) or absolute http(s) web links. */
export function normalizeAdHref(raw: string):
  | { ok: true; href: string }
  | { ok: false; error: string } {
  const href = raw.trim();
  if (!href) {
    return { ok: false, error: "Link is required" };
  }

  if (href.length > 255) {
    return { ok: false, error: "Link is too long (max 255 characters)" };
  }

  if (href.startsWith("/") && !href.startsWith("//")) {
    return { ok: true, href };
  }

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        ok: false,
        error: "Web links must use http:// or https://",
      };
    }
    if (url.href.length > 255) {
      return { ok: false, error: "Link is too long (max 255 characters)" };
    }
    return { ok: true, href: url.href };
  } catch {
    return {
      ok: false,
      error:
        "Enter a service path (e.g. /services/gift-cards) or a full URL (https://…)",
    };
  }
}

export function isExternalAdHref(href: string) {
  return /^https?:\/\//i.test(href.trim());
}

export const DEFAULT_OVERLAY =
  "from-oryno-charcoal/85 via-oryno-charcoal/40 to-transparent";

export const DEFAULT_OVERLAY_COLORS = [
  "rgba(28,28,30,0.88)",
  "rgba(28,28,30,0.35)",
  "transparent",
] as const;

export function isAdStatus(value: string): value is AdStatus {
  return AD_STATUS_OPTIONS.some((o) => o.value === value);
}

export function isAdPlacement(value: string): value is AdPlacement {
  return AD_PLACEMENT_OPTIONS.some((o) => o.value === value);
}

export function adStatusLabel(status: string) {
  return (
    AD_STATUS_OPTIONS.find((o) => o.value === status)?.label ||
    status.charAt(0).toUpperCase() + status.slice(1)
  );
}

export function parseDateInput(value?: string | null): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isAdCurrentlyActive(ad: {
  status: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
}) {
  if (ad.status !== "live") return false;
  const now = Date.now();
  if (ad.startsAt && ad.startsAt.getTime() > now) return false;
  if (ad.endsAt && ad.endsAt.getTime() < now) return false;
  return true;
}

export function shapeAd(row: {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  href: string;
  badge: string | null;
  overlay: string | null;
  overlayColors: string[] | null;
  placement: string;
  status: string;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const now = Date.now();
  const expired = Boolean(row.endsAt && row.endsAt.getTime() < now);
  const scheduled = Boolean(row.startsAt && row.startsAt.getTime() > now);

  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.imageUrl,
    href: row.href,
    badge: row.badge,
    overlay: row.overlay || DEFAULT_OVERLAY,
    overlayColors: row.overlayColors?.length
      ? row.overlayColors
      : [...DEFAULT_OVERLAY_COLORS],
    placement: row.placement,
    placementLabel: adPlacementLabel(row.placement),
    status: row.status,
    statusLabel: adStatusLabel(row.status),
    sortOrder: row.sortOrder,
    startsAt: row.startsAt?.toISOString() ?? null,
    endsAt: row.endsAt?.toISOString() ?? null,
    expired,
    scheduled,
    active: isAdCurrentlyActive(row),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
