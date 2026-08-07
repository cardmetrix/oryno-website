import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { onboardingSlides } from "@/lib/db/schema";
import {
  DEFAULT_ONBOARDING_SLIDES,
  absoluteOnboardingImageUrl,
} from "@/lib/admin/onboarding";

let seeding: Promise<void> | null = null;

/** Insert the current app onboarding slides once if the table is empty. */
export async function ensureDefaultOnboardingSlides() {
  if (!seeding) {
    seeding = (async () => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(onboardingSlides);

      if (Number(count) > 0) return;

      await db.insert(onboardingSlides).values(
        DEFAULT_ONBOARDING_SLIDES.map((slide) => ({
          title: slide.title,
          subtitle: slide.subtitle,
          imageUrl: absoluteOnboardingImageUrl(slide.imagePath),
          accent: slide.accent,
          status: "live" as const,
          sortOrder: slide.sortOrder,
          metadata: { key: slide.key, seeded: true },
        })),
      );
    })().catch((error) => {
      seeding = null;
      console.error("[seed-onboarding]", error);
      throw error;
    });
  }

  await seeding;
}
