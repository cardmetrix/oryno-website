import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  DEFAULT_OVERLAY,
  DEFAULT_OVERLAY_COLORS,
  isAdPlacement,
  maxLiveAdsForPlacement,
  shapeAd,
  type AdPlacement,
} from "@/lib/admin/ads";
import { db } from "@/lib/db";
import { ads } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Public ads for carousels (web + mobile). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const rawPlacement = searchParams.get("placement") || "home_carousel";
    const placement: AdPlacement = isAdPlacement(rawPlacement)
      ? rawPlacement
      : "home_carousel";
    const now = new Date();

    const rows = await db
      .select()
      .from(ads)
      .where(
        and(
          eq(ads.status, "live"),
          eq(ads.placement, placement),
          or(isNull(ads.startsAt), lte(ads.startsAt, now)),
          or(isNull(ads.endsAt), gt(ads.endsAt, now)),
        ),
      )
      .orderBy(asc(ads.sortOrder), asc(ads.createdAt));

    const maxLive = maxLiveAdsForPlacement(placement);
    const limited = maxLive != null ? rows.slice(0, maxLive) : rows;

    return NextResponse.json(
      {
        ok: true,
        ads: limited.map((row) => {
          const shaped = shapeAd(row);
          return {
            id: shaped.id,
            title: shaped.title,
            subtitle: shaped.subtitle,
            imageUrl: shaped.imageUrl,
            href: shaped.href,
            badge: shaped.badge,
            overlay: shaped.overlay || DEFAULT_OVERLAY,
            overlayColors: shaped.overlayColors?.length
              ? shaped.overlayColors
              : [...DEFAULT_OVERLAY_COLORS],
            sortOrder: shaped.sortOrder,
            endsAt: shaped.endsAt,
          };
        }),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("[ads-get]", error);
    return NextResponse.json({ error: "Failed to load ads" }, { status: 500 });
  }
}
