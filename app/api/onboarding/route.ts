import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { shapeOnboardingSlide } from "@/lib/admin/onboarding";
import { ensureDefaultOnboardingSlides } from "@/lib/admin/seed-onboarding";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { onboardingSlides } from "@/lib/db/schema";

export const runtime = "nodejs";

/** Public onboarding slides for the mobile app (pre-auth). */
export async function GET() {
  try {
    await ensureWalletSchema();
    try {
      await ensureDefaultOnboardingSlides();
    } catch {
      // Table may already have rows or seed may race — continue to query.
    }

    const rows = await db
      .select()
      .from(onboardingSlides)
      .where(eq(onboardingSlides.status, "live"))
      .orderBy(asc(onboardingSlides.sortOrder), asc(onboardingSlides.createdAt));

    return NextResponse.json({
      ok: true,
      slides: rows.map((row) => {
        const shaped = shapeOnboardingSlide(row);
        return {
          id: shaped.id,
          title: shaped.title,
          subtitle: shaped.subtitle,
          imageUrl: shaped.imageUrl,
          accent: shaped.accent,
          sortOrder: shaped.sortOrder,
        };
      }),
    });
  } catch (error) {
    console.error("[onboarding-get]", error);
    return NextResponse.json(
      { error: "Failed to load onboarding" },
      { status: 500 },
    );
  }
}
