import type { JapService } from "./client";

export const JAP_PLATFORMS = [
  "All",
  "Instagram",
  "TikTok",
  "YouTube",
  "Facebook",
  "X",
  "Telegram",
  "Spotify",
  "Twitter",
  "Other",
] as const;

export type JapPlatform = (typeof JAP_PLATFORMS)[number];

export type JapCatalogService = JapService & {
  platform: Exclude<JapPlatform, "All">;
  metric: string;
  quality: string;
  /** USD cost for `quantity` units (rate is typically per 1000) */
  priceUsdFor: (quantity: number) => number;
};

/** Demo catalog when the Famsup API key is missing. Rates = USD per 1000. */
export const FALLBACK_JAP_SERVICES: JapService[] = [
  {
    service: 1001,
    name: "Instagram Followers [Real] [HQ]",
    type: "Default",
    category: "Instagram",
    rate: 1.2,
    min: 100,
    max: 50000,
    refill: true,
    cancel: false,
  },
  {
    service: 1002,
    name: "Instagram Likes [Instant]",
    type: "Default",
    category: "Instagram",
    rate: 0.35,
    min: 50,
    max: 100000,
    refill: true,
    cancel: true,
  },
  {
    service: 2001,
    name: "TikTok Followers",
    type: "Default",
    category: "TikTok",
    rate: 1.8,
    min: 100,
    max: 20000,
    refill: true,
    cancel: false,
  },
  {
    service: 2002,
    name: "TikTok Views",
    type: "Default",
    category: "TikTok",
    rate: 0.15,
    min: 1000,
    max: 1000000,
    refill: false,
    cancel: true,
  },
  {
    service: 3001,
    name: "YouTube Subscribers",
    type: "Default",
    category: "YouTube",
    rate: 4.5,
    min: 50,
    max: 5000,
    refill: true,
    cancel: false,
  },
  {
    service: 3002,
    name: "YouTube Views",
    type: "Default",
    category: "YouTube",
    rate: 0.9,
    min: 500,
    max: 100000,
    refill: false,
    cancel: true,
  },
  {
    service: 4001,
    name: "Facebook Page Likes",
    type: "Default",
    category: "Facebook",
    rate: 1.1,
    min: 100,
    max: 20000,
    refill: true,
    cancel: false,
  },
  {
    service: 5001,
    name: "X / Twitter Followers",
    type: "Default",
    category: "Twitter",
    rate: 2.2,
    min: 100,
    max: 10000,
    refill: true,
    cancel: false,
  },
  {
    service: 6001,
    name: "Telegram Members",
    type: "Default",
    category: "Telegram",
    rate: 1.5,
    min: 50,
    max: 15000,
    refill: true,
    cancel: false,
  },
  {
    service: 1003,
    name: "Instagram Custom Comments",
    type: "Custom Comments",
    category: "Instagram",
    rate: 8,
    min: 5,
    max: 100,
    refill: false,
    cancel: true,
  },
];

/** JAP packages that require a newline-separated `comments` payload. */
export function isCustomCommentsService(service: {
  type?: string | null;
  quality?: string | null;
  name?: string | null;
}) {
  const hay = `${service.type || ""} ${service.quality || ""} ${service.name || ""}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  return /\bcustom\s*comments?\b/.test(hay);
}

/** Normalize UI / API comment lists into trimmed non-empty lines. */
export function normalizeCustomComments(
  input?: string | string[] | null,
): string[] {
  if (input == null) return [];
  const lines = Array.isArray(input)
    ? input.flatMap((c) => String(c).split(/\r?\n/))
    : String(input).split(/\r?\n/);
  return lines.map((line) => line.trim()).filter(Boolean);
}

export function detectPlatform(
  category: string,
  name: string,
): Exclude<JapPlatform, "All"> {
  const hay = `${category} ${name}`.toLowerCase();
  if (hay.includes("instagram") || hay.includes(" ig ")) return "Instagram";
  if (hay.includes("tiktok") || hay.includes("tik tok")) return "TikTok";
  if (hay.includes("youtube") || hay.includes("yt ")) return "YouTube";
  if (hay.includes("facebook") || hay.includes(" fb ")) return "Facebook";
  if (hay.includes("telegram") || hay.includes(" tg ")) return "Telegram";
  if (hay.includes("spotify")) return "Spotify";
  if (
    hay.includes("twitter") ||
    /\bx\b/.test(hay) ||
    hay.includes("tweet")
  ) {
    return hay.includes("twitter") ? "Twitter" : "X";
  }
  return "Other";
}

export function detectMetric(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("follower")) return "Followers";
  if (n.includes("subscriber") || n.includes("subs")) return "Subscribers";
  if (n.includes("like")) return "Likes";
  if (n.includes("view")) return "Views";
  if (n.includes("member")) return "Members";
  if (n.includes("comment")) return "Comments";
  if (n.includes("share")) return "Shares";
  if (n.includes("react")) return "Reactions";
  if (n.includes("save")) return "Saves";
  if (n.includes("play")) return "Plays";
  return "Boost";
}

/** Quality tier inferred from JAP package titles / types. */
export function detectQuality(name: string, type?: string): string {
  const n = `${name} ${type || ""}`.toLowerCase();
  if (/\b(premium|vip|elite|ultra)\b/.test(n)) return "Premium";
  if (/\b(hq|high[\s-]?quality|real|organic|active|no[\s-]?drop)\b/.test(n)) {
    return "High Quality";
  }
  if (/\b(instant|fast|speed|express)\b/.test(n)) return "Instant";
  if (/\b(cheap|economy|budget|low[\s-]?drop|least)\b/.test(n)) {
    return "Economy";
  }
  if (type && type.trim() && !/^default$/i.test(type.trim())) {
    return type.trim();
  }
  return "Standard";
}

/** JAP rate is USD cost per 1000 units for Default services. */
export function japUsdCost(ratePerThousand: number, quantity: number) {
  if (!Number.isFinite(ratePerThousand) || !Number.isFinite(quantity)) return 0;
  return (ratePerThousand * quantity) / 1000;
}

export function enrichJapService(raw: JapService): JapCatalogService {
  const platform = detectPlatform(raw.category, raw.name);
  const metric = detectMetric(raw.name);
  const quality = detectQuality(raw.name, raw.type);
  return {
    ...raw,
    platform,
    metric,
    quality,
    priceUsdFor: (quantity: number) => japUsdCost(raw.rate, quantity),
  };
}

export function filterJapServices(
  list: JapCatalogService[],
  opts: { platform?: string; query?: string },
) {
  const platform = opts.platform || "All";
  const q = (opts.query || "").trim().toLowerCase();

  return list.filter((s) => {
    const matchPlatform =
      platform === "All" ||
      s.platform === platform ||
      (platform === "X" && s.platform === "Twitter") ||
      (platform === "Twitter" && s.platform === "X");

    if (!matchPlatform) return false;
    if (!q) return true;

    return (
      s.name.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.metric.toLowerCase().includes(q) ||
      String(s.service).includes(q)
    );
  });
}

export function defaultQuantity(service: Pick<JapService, "min" | "max">) {
  const min = Math.max(1, service.min || 1);
  const max = Math.max(min, service.max || min);
  // Prefer a round starter qty within range
  const candidates = [100, 500, 1000, 2500, 5000, 10000];
  for (const c of candidates) {
    if (c >= min && c <= max) return c;
  }
  return min;
}

