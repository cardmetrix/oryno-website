import { asc, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { db } from "@/lib/db";
import { testimonialReviews } from "@/lib/db/schema";
import {
  averageRating,
  clampRating,
  shapePublicTestimonial,
} from "@/lib/testimonials";
import { ensureDefaultTestimonials } from "@/lib/testimonials/seed";

export const runtime = "nodejs";

/** Approved landing-page reviews. */
export async function GET() {
  try {
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

    return NextResponse.json({
      ok: true,
      reviews,
      stats: {
        count: reviews.length,
        averageRating: averageRating(reviews),
      },
    });
  } catch (error) {
    console.error("[testimonials-get]", error);
    return NextResponse.json(
      { error: "Failed to load reviews" },
      { status: 500 },
    );
  }
}

/** Submit a review for admin approval. */
export async function POST(req: Request) {
  try {
    await ensureWalletSchema();

    const body = (await req.json().catch(() => ({}))) as {
      authorName?: string;
      authorRole?: string;
      rating?: number;
      body?: string;
      website?: string;
    };

    if (String(body.website || "").trim()) {
      return NextResponse.json({ ok: true, pending: true });
    }

    const authorName = String(body.authorName || "").trim();
    const authorRole = String(body.authorRole || "").trim() || null;
    const reviewBody = String(body.body || "").trim();
    const rating = clampRating(body.rating);

    if (!authorName || authorName.length < 2) {
      return NextResponse.json(
        { error: "Please enter your name" },
        { status: 400 },
      );
    }
    if (authorName.length > 120) {
      return NextResponse.json(
        { error: "Name is too long" },
        { status: 400 },
      );
    }
    if (!reviewBody || reviewBody.length < 12) {
      return NextResponse.json(
        { error: "Please write at least 12 characters in your review" },
        { status: 400 },
      );
    }
    if (reviewBody.length > 600) {
      return NextResponse.json(
        { error: "Review must be 600 characters or less" },
        { status: 400 },
      );
    }
    if (authorRole && authorRole.length > 120) {
      return NextResponse.json(
        { error: "Location or role is too long" },
        { status: 400 },
      );
    }

    const [created] = await db
      .insert(testimonialReviews)
      .values({
        authorName,
        authorRole,
        rating,
        body: reviewBody,
        status: "pending",
      })
      .returning();

    return NextResponse.json({
      ok: true,
      pending: true,
      message:
        "Thanks! Your review was submitted and will appear after our team approves it.",
      review: shapePublicTestimonial(created),
    });
  } catch (error) {
    console.error("[testimonials-post]", error);
    return NextResponse.json(
      { error: "Failed to submit review" },
      { status: 500 },
    );
  }
}
