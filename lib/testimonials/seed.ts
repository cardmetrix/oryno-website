import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { testimonialReviews } from "@/lib/db/schema";
import { DEFAULT_TESTIMONIAL_REVIEWS } from "@/lib/testimonials";

let seeding: Promise<void> | null = null;

/** Insert up to 10 approved demo reviews once if the table is empty. */
export async function ensureDefaultTestimonials() {
  if (!seeding) {
    seeding = (async () => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(testimonialReviews);

      if (Number(count) > 0) return;

      const now = new Date();
      await db.insert(testimonialReviews).values(
        DEFAULT_TESTIMONIAL_REVIEWS.map((review) => ({
          authorName: review.authorName,
          authorRole: review.authorRole,
          rating: review.rating,
          body: review.body,
          status: "approved" as const,
          featured: review.featured,
          sortOrder: review.sortOrder,
          approvedAt: now,
          metadata: { key: review.key, seeded: true },
        })),
      );
    })().catch((error) => {
      seeding = null;
      console.error("[seed-testimonials]", error);
      throw error;
    });
  }

  await seeding;
}
