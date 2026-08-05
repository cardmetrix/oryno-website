import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  AD_PLACEMENT_OPTIONS,
  AD_STATUS_OPTIONS,
  DEFAULT_OVERLAY,
  DEFAULT_OVERLAY_COLORS,
  AD_SERVICE_LINK_OPTIONS,
  isAdPlacement,
  isAdStatus,
  normalizeAdHref,
  parseDateInput,
  shapeAd,
  type AdPlacement,
  type AdStatus,
} from "@/lib/admin/ads";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { ads } from "@/lib/db/schema";
import { uploadBase64Image, type ImagePayload } from "@/lib/upload-image";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const placement = searchParams.get("placement");

    let rows = await db
      .select()
      .from(ads)
      .orderBy(asc(ads.sortOrder), desc(ads.createdAt));

    if (status && isAdStatus(status)) {
      rows = rows.filter((r) => r.status === status);
    }
    if (placement && isAdPlacement(placement)) {
      rows = rows.filter((r) => r.placement === placement);
    }

    return NextResponse.json({
      ok: true,
      statusOptions: AD_STATUS_OPTIONS,
      placementOptions: AD_PLACEMENT_OPTIONS,
      serviceLinkOptions: AD_SERVICE_LINK_OPTIONS,
      ads: rows.map(shapeAd),
    });
  });
}

export async function POST(req: Request) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      subtitle?: string;
      imageUrl?: string;
      image?: ImagePayload;
      href?: string;
      badge?: string;
      overlay?: string;
      overlayColors?: string[];
      placement?: string;
      status?: string;
      sortOrder?: number;
      startsAt?: string | null;
      endsAt?: string | null;
    };

    const title = String(body.title || "").trim();
    const hrefResult = normalizeAdHref(String(body.href || ""));
    const subtitle = String(body.subtitle || "").trim() || null;
    const badge = String(body.badge || "").trim() || null;
    const overlay = String(body.overlay || "").trim() || DEFAULT_OVERLAY;
    const overlayColors =
      Array.isArray(body.overlayColors) && body.overlayColors.length
        ? body.overlayColors.map(String)
        : [...DEFAULT_OVERLAY_COLORS];
    const placement: AdPlacement = isAdPlacement(String(body.placement || ""))
      ? (body.placement as AdPlacement)
      : "home_carousel";
    const status: AdStatus = isAdStatus(String(body.status || ""))
      ? (body.status as AdStatus)
      : "draft";
    const sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Math.max(0, Math.floor(Number(body.sortOrder)))
      : 0;
    const startsAt = parseDateInput(body.startsAt);
    const endsAt = parseDateInput(body.endsAt);

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!hrefResult.ok) {
      return NextResponse.json({ error: hrefResult.error }, { status: 400 });
    }
    const href = hrefResult.href;
    if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
      return NextResponse.json(
        { error: "Expiry must be after the start date" },
        { status: 400 },
      );
    }

    let imageUrl = String(body.imageUrl || "").trim();
    try {
      const uploaded = await uploadBase64Image(body.image, `ad-${Date.now()}.jpg`);
      if (uploaded) imageUrl = uploaded;
    } catch (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to upload image",
        },
        { status: 400 },
      );
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Upload an image or provide an image URL" },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(ads)
      .values({
        title,
        subtitle,
        imageUrl,
        href,
        badge,
        overlay,
        overlayColors,
        placement,
        status,
        sortOrder,
        startsAt,
        endsAt,
        createdByAdminId: admin.id,
      })
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "ad.create",
      entityType: "ad",
      entityId: created.id,
      meta: { title, status, placement },
    });

    return NextResponse.json({ ok: true, ad: shapeAd(created) });
  });
}
