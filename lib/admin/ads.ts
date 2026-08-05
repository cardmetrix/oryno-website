export const AD_STATUS_OPTIONS = [
  { value: "draft", label: "Draft", description: "Hidden from users" },
  { value: "live", label: "Live", description: "Shown in the carousel" },
  { value: "paused", label: "Paused", description: "Temporarily hidden" },
  { value: "archived", label: "Archived", description: "Kept but not shown" },
] as const;

export type AdStatus = (typeof AD_STATUS_OPTIONS)[number]["value"];

export const AD_PLACEMENT_OPTIONS = [
  { value: "home_carousel", label: "Home carousel" },
  { value: "promo_banner", label: "Promo banner" },
] as const;

export type AdPlacement = (typeof AD_PLACEMENT_OPTIONS)[number]["value"];

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
