import { and, count, eq, ne } from "drizzle-orm";
import {
  adPlacementLabel,
  maxLiveAdsForPlacement,
  type AdPlacement,
  type AdStatus,
} from "@/lib/admin/ads";
import { db } from "@/lib/db";
import { ads } from "@/lib/db/schema";

/** Enforce per-placement live caps (e.g. services carousel max 3). */
export async function assertLiveAdCap(opts: {
  placement: AdPlacement;
  status: AdStatus;
  excludeId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxLive = maxLiveAdsForPlacement(opts.placement);
  if (maxLive == null || opts.status !== "live") return { ok: true };

  const conditions = [
    eq(ads.placement, opts.placement),
    eq(ads.status, "live"),
  ];
  if (opts.excludeId) {
    conditions.push(ne(ads.id, opts.excludeId));
  }

  const [row] = await db
    .select({ total: count() })
    .from(ads)
    .where(and(...conditions));

  const liveCount = Number(row?.total ?? 0);
  if (liveCount >= maxLive) {
    const label = adPlacementLabel(opts.placement);
    return {
      ok: false,
      error: `${label} allows at most ${maxLive} live ads. Pause or archive one before adding another.`,
    };
  }
  return { ok: true };
}

export async function liveAdCountsByPlacement() {
  const rows = await db
    .select({
      placement: ads.placement,
      total: count(),
    })
    .from(ads)
    .where(eq(ads.status, "live"))
    .groupBy(ads.placement);

  const map: Record<string, number> = {};
  for (const row of rows) {
    map[row.placement] = Number(row.total);
  }
  return map;
}
