import { asc, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  DEFAULT_ONBOARDING_ACCENT,
  ONBOARDING_STATUS_OPTIONS,
  isOnboardingStatus,
  normalizeAccent,
  shapeOnboardingSlide,
  type OnboardingStatus,
} from "@/lib/admin/onboarding";
import { ensureDefaultOnboardingSlides } from "@/lib/admin/seed-onboarding";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { onboardingSlides } from "@/lib/db/schema";
import { uploadBase64Image, type ImagePayload } from "@/lib/upload-image";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    try {
      await ensureDefaultOnboardingSlides();
    } catch {
      // continue even if seed races
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let rows = await db
      .select()
      .from(onboardingSlides)
      .orderBy(asc(onboardingSlides.sortOrder), desc(onboardingSlides.createdAt));

    if (status && isOnboardingStatus(status)) {
      rows = rows.filter((r) => r.status === status);
    }

    return NextResponse.json({
      ok: true,
      statusOptions: ONBOARDING_STATUS_OPTIONS,
      slides: rows.map(shapeOnboardingSlide),
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
      accent?: string;
      status?: string;
      sortOrder?: number;
    };

    const title = String(body.title || "").trim();
    const subtitle = String(body.subtitle || "").trim();
    const accent = normalizeAccent(body.accent);
    const status: OnboardingStatus = isOnboardingStatus(String(body.status || ""))
      ? (body.status as OnboardingStatus)
      : "draft";
    const sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Math.max(0, Math.floor(Number(body.sortOrder)))
      : 0;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    if (!subtitle) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    let imageUrl = String(body.imageUrl || "").trim();
    try {
      const uploaded = await uploadBase64Image(
        body.image,
        `onboarding-${Date.now()}.jpg`,
      );
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
      .insert(onboardingSlides)
      .values({
        title,
        subtitle,
        imageUrl,
        accent: accent || DEFAULT_ONBOARDING_ACCENT,
        status,
        sortOrder,
        createdByAdminId: admin.id,
      })
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "onboarding.create",
      entityType: "onboarding_slide",
      entityId: created.id,
      meta: { title, status, sortOrder },
    });

    return NextResponse.json({
      ok: true,
      slide: shapeOnboardingSlide(created),
    });
  });
}
