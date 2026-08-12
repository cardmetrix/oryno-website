import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { landingAssets } from "@/lib/db/schema";
import {
  absoluteLandingAssetUrl,
  getLandingAssetDef,
  isLandingAssetSlot,
  shapeLandingAsset,
} from "@/lib/landing/assets";
import { ensureLandingAssets } from "@/lib/landing/seed";
import { uploadBase64Image, type ImagePayload } from "@/lib/upload-image";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    await ensureLandingAssets();
    const { id } = await ctx.params;

    const [existing] = await db
      .select()
      .from(landingAssets)
      .where(eq(landingAssets.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      imageUrl?: string;
      image?: ImagePayload;
      label?: string;
      description?: string | null;
      reset?: boolean;
    };

    const patch: Partial<typeof landingAssets.$inferInsert> = {
      updatedAt: new Date(),
      updatedByAdminId: admin.id,
    };

    if (body.reset) {
      const def = getLandingAssetDef(existing.slot);
      const path = def?.defaultPath || existing.defaultPath;
      patch.imageUrl = absoluteLandingAssetUrl(path);
      patch.defaultPath = path;
    } else {
      try {
        const uploaded = await uploadBase64Image(
          body.image,
          `landing-${existing.slot}-${Date.now()}.jpg`,
        );
        if (uploaded) {
          patch.imageUrl = uploaded;
        } else if (body.imageUrl != null) {
          const imageUrl = String(body.imageUrl).trim();
          if (!imageUrl) {
            return NextResponse.json(
              { error: "Image URL cannot be empty" },
              { status: 400 },
            );
          }
          patch.imageUrl = imageUrl.startsWith("http")
            ? imageUrl
            : absoluteLandingAssetUrl(imageUrl);
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
    }

    if (body.label != null) {
      const label = String(body.label).trim();
      if (!label) {
        return NextResponse.json({ error: "Label is required" }, { status: 400 });
      }
      patch.label = label;
    }
    if (body.description !== undefined) {
      patch.description = body.description
        ? String(body.description).trim().slice(0, 280)
        : null;
    }

    if (
      !body.reset &&
      patch.imageUrl == null &&
      body.label == null &&
      body.description === undefined
    ) {
      return NextResponse.json(
        { error: "Upload an image, provide a URL, or reset to default" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(landingAssets)
      .set(patch)
      .where(eq(landingAssets.id, id))
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: body.reset ? "landing.reset" : "landing.update",
      entityType: "landing_asset",
      entityId: id,
      meta: {
        slot: existing.slot,
        reset: Boolean(body.reset),
        fields: Object.keys(body),
      },
    });

    return NextResponse.json({
      ok: true,
      asset: shapeLandingAsset(updated),
    });
  });
}

/** Reset slot image back to the bundled default (does not delete the slot). */
export async function DELETE(_req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    await ensureLandingAssets();
    const { id } = await ctx.params;

    const [existing] = await db
      .select()
      .from(landingAssets)
      .where(eq(landingAssets.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }
    if (!isLandingAssetSlot(existing.slot)) {
      return NextResponse.json({ error: "Unknown slot" }, { status: 400 });
    }

    const def = getLandingAssetDef(existing.slot);
    const path = def?.defaultPath || existing.defaultPath;

    const [updated] = await db
      .update(landingAssets)
      .set({
        imageUrl: absoluteLandingAssetUrl(path),
        defaultPath: path,
        updatedAt: new Date(),
        updatedByAdminId: admin.id,
      })
      .where(eq(landingAssets.id, id))
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "landing.reset",
      entityType: "landing_asset",
      entityId: id,
      meta: { slot: existing.slot, defaultPath: path },
    });

    return NextResponse.json({
      ok: true,
      asset: shapeLandingAsset(updated),
    });
  });
}
