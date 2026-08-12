import { asc, desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { db } from "@/lib/db";
import { testimonialReviews } from "@/lib/db/schema";
import {
  TESTIMONIAL_STATUS_OPTIONS,
  clampRating,
  isTestimonialStatus,
  shapeTestimonialReview,
  type TestimonialStatus,
} from "@/lib/testimonials";
import { ensureDefaultTestimonials } from "@/lib/testimonials/seed";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    try {
      await ensureDefaultTestimonials();
    } catch {
      // continue even if seed races
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let rows = await db
      .select()
      .from(testimonialReviews)
      .orderBy(
        desc(testimonialReviews.featured),
        asc(testimonialReviews.sortOrder),
        desc(testimonialReviews.createdAt),
      );

    if (status && isTestimonialStatus(status)) {
      rows = rows.filter((row) => row.status === status);
    }

    return NextResponse.json({
      ok: true,
      statusOptions: TESTIMONIAL_STATUS_OPTIONS,
      reviews: rows.map(shapeTestimonialReview),
    });
  });
}

export async function POST(req: Request) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();

    const body = (await req.json().catch(() => ({}))) as {
      authorName?: string;
      authorRole?: string;
      rating?: number;
      body?: string;
      status?: string;
      featured?: boolean;
      sortOrder?: number;
    };

    const authorName = String(body.authorName || "").trim();
    const reviewBody = String(body.body || "").trim();
    const authorRole = String(body.authorRole || "").trim() || null;
    const status: TestimonialStatus = isTestimonialStatus(
      String(body.status || ""),
    )
      ? (body.status as TestimonialStatus)
      : "approved";
    const rating = clampRating(body.rating);
    const featured = Boolean(body.featured);
    const sortOrder = Number.isFinite(Number(body.sortOrder))
      ? Math.max(0, Math.floor(Number(body.sortOrder)))
      : 0;

    if (!authorName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!reviewBody) {
      return NextResponse.json({ error: "Review text is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(testimonialReviews)
      .values({
        authorName,
        authorRole,
        rating,
        body: reviewBody,
        status,
        featured,
        sortOrder,
        approvedByAdminId: status === "approved" ? admin.id : null,
        approvedAt: status === "approved" ? new Date() : null,
      })
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "testimonial.create",
      entityType: "testimonial_review",
      entityId: created.id,
      meta: { authorName, status, featured },
    });

    return NextResponse.json({
      ok: true,
      review: shapeTestimonialReview(created),
    });
  });
}
