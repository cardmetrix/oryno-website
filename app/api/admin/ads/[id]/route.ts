import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { assertLiveAdCap } from "@/lib/admin/ad-limits";
import {
  DEFAULT_OVERLAY,
  DEFAULT_OVERLAY_COLORS,
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

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const row = await db.query.ads.findFirst({ where: eq(ads.id, id) });
    if (!row) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ad: shapeAd(row) });
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const existing = await db.query.ads.findFirst({ where: eq(ads.id, id) });
    if (!existing) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      subtitle?: string | null;
      imageUrl?: string;
      image?: ImagePayload;
      href?: string;
      badge?: string | null;
      overlay?: string | null;
      overlayColors?: string[];
      placement?: string;
      status?: string;
      sortOrder?: number;
      startsAt?: string | null;
      endsAt?: string | null;
    };

    const patch: Partial<typeof ads.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title != null) {
      const title = String(body.title).trim();
      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      patch.title = title;
    }
    if (body.subtitle !== undefined) {
      patch.subtitle = String(body.subtitle || "").trim() || null;
    }
    if (body.href != null) {
      const hrefResult = normalizeAdHref(String(body.href));
      if (!hrefResult.ok) {
        return NextResponse.json(
          { error: hrefResult.error },
          { status: 400 },
        );
      }
      patch.href = hrefResult.href;
    }
    if (body.badge !== undefined) {
      patch.badge = String(body.badge || "").trim() || null;
    }
    if (body.overlay !== undefined) {
      patch.overlay = String(body.overlay || "").trim() || DEFAULT_OVERLAY;
    }
    if (body.overlayColors !== undefined) {
      patch.overlayColors =
        Array.isArray(body.overlayColors) && body.overlayColors.length
          ? body.overlayColors.map(String)
          : [...DEFAULT_OVERLAY_COLORS];
    }
    if (body.placement != null) {
      if (!isAdPlacement(body.placement)) {
        return NextResponse.json({ error: "Invalid placement" }, { status: 400 });
      }
      patch.placement = body.placement as AdPlacement;
    }
    if (body.status != null) {
      if (!isAdStatus(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status as AdStatus;
    }
    if (body.sortOrder != null) {
      patch.sortOrder = Math.max(0, Math.floor(Number(body.sortOrder) || 0));
    }
    if (body.startsAt !== undefined) {
      patch.startsAt = parseDateInput(body.startsAt);
    }
    if (body.endsAt !== undefined) {
      patch.endsAt = parseDateInput(body.endsAt);
    }

    try {
      const uploaded = await uploadBase64Image(body.image, `ad-${id}.jpg`);
      if (uploaded) patch.imageUrl = uploaded;
      else if (body.imageUrl != null) {
        const imageUrl = String(body.imageUrl).trim();
        if (!imageUrl) {
          return NextResponse.json(
            { error: "Image URL cannot be empty" },
            { status: 400 },
          );
        }
        patch.imageUrl = imageUrl;
      }
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

    const nextStarts = patch.startsAt !== undefined ? patch.startsAt : existing.startsAt;
    const nextEnds = patch.endsAt !== undefined ? patch.endsAt : existing.endsAt;
    if (nextStarts && nextEnds && nextEnds.getTime() <= nextStarts.getTime()) {
      return NextResponse.json(
        { error: "Expiry must be after the start date" },
        { status: 400 },
      );
    }

    const nextPlacement = (patch.placement ?? existing.placement) as AdPlacement;
    const nextStatus = (patch.status ?? existing.status) as AdStatus;
    const cap = await assertLiveAdCap({
      placement: nextPlacement,
      status: nextStatus,
      excludeId: id,
    });
    if (!cap.ok) {
      return NextResponse.json({ error: cap.error }, { status: 400 });
    }

    const [updated] = await db
      .update(ads)
      .set(patch)
      .where(eq(ads.id, id))
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "ad.update",
      entityType: "ad",
      entityId: id,
      meta: {
        fromStatus: existing.status,
        toStatus: updated.status,
        fields: Object.keys(body),
      },
    });

    return NextResponse.json({ ok: true, ad: shapeAd(updated) });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const existing = await db.query.ads.findFirst({ where: eq(ads.id, id) });
    if (!existing) {
      return NextResponse.json({ error: "Ad not found" }, { status: 404 });
    }

    await db.delete(ads).where(eq(ads.id, id));

    await writeAdminAudit({
      adminId: admin.id,
      action: "ad.delete",
      entityType: "ad",
      entityId: id,
      meta: { title: existing.title },
    });

    return NextResponse.json({ ok: true });
  });
}
