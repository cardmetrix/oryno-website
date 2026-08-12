import { asc, desc, eq } from "drizzle-orm";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { db } from "@/lib/db";
import { testimonialReviews } from "@/lib/db/schema";
import {
  averageRating,
  shapePublicTestimonial,
} from "@/lib/testimonials";
import { ensureDefaultTestimonials } from "@/lib/testimonials/seed";

export async function getApprovedTestimonials() {
  await ensureWalletSchema();
  try {
    await ensureDefaultTestimonials();
  } catch {
    // continue even if seed races
  }

  const rows = await db
    .select()
    .from(testimonialReviews)
    .where(eq(testimonialReviews.status, "approved"))
    .orderBy(
      desc(testimonialReviews.featured),
      asc(testimonialReviews.sortOrder),
      desc(testimonialReviews.createdAt),
    );

  const reviews = rows.map(shapePublicTestimonial);

  return {
    reviews,
    stats: {
      count: reviews.length,
      averageRating: averageRating(reviews),
    },
  };
}
