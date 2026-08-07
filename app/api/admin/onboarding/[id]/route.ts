import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  isOnboardingStatus,
  normalizeAccent,
  shapeOnboardingSlide,
  type OnboardingStatus,
} from "@/lib/admin/onboarding";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { onboardingSlides } from "@/lib/db/schema";
import { uploadBase64Image, type ImagePayload } from "@/lib/upload-image";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const [row] = await db
      .select()
      .from(onboardingSlides)
      .where(eq(onboardingSlides.id, id))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, slide: shapeOnboardingSlide(row) });
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const [existing] = await db
      .select()
      .from(onboardingSlides)
      .where(eq(onboardingSlides.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      subtitle?: string;
      imageUrl?: string;
      image?: ImagePayload;
      accent?: string | null;
      status?: string;
      sortOrder?: number;
    };

    const patch: Partial<typeof onboardingSlides.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.title != null) {
      const title = String(body.title).trim();
      if (!title) {
        return NextResponse.json({ error: "Title is required" }, { status: 400 });
      }
      patch.title = title;
    }
    if (body.subtitle != null) {
      const subtitle = String(body.subtitle).trim();
      if (!subtitle) {
        return NextResponse.json(
          { error: "Description is required" },
          { status: 400 },
        );
      }
      patch.subtitle = subtitle;
    }
    if (body.accent !== undefined) {
      patch.accent = normalizeAccent(body.accent);
    }
    if (body.status != null) {
      if (!isOnboardingStatus(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status as OnboardingStatus;
    }
    if (body.sortOrder != null) {
      patch.sortOrder = Math.max(0, Math.floor(Number(body.sortOrder) || 0));
    }

    try {
      const uploaded = await uploadBase64Image(
        body.image,
        `onboarding-${id}.jpg`,
      );
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

    const [updated] = await db
      .update(onboardingSlides)
      .set(patch)
      .where(eq(onboardingSlides.id, id))
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "onboarding.update",
      entityType: "onboarding_slide",
      entityId: id,
      meta: {
        fromStatus: existing.status,
        toStatus: updated.status,
        fields: Object.keys(body),
      },
    });

    return NextResponse.json({
      ok: true,
      slide: shapeOnboardingSlide(updated),
    });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const [existing] = await db
      .select()
      .from(onboardingSlides)
      .where(eq(onboardingSlides.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Slide not found" }, { status: 404 });
    }

    await db.delete(onboardingSlides).where(eq(onboardingSlides.id, id));

    await writeAdminAudit({
      adminId: admin.id,
      action: "onboarding.delete",
      entityType: "onboarding_slide",
      entityId: id,
      meta: { title: existing.title },
    });

    return NextResponse.json({ ok: true });
  });
}
