import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { db } from "@/lib/db";
import { testimonialReviews } from "@/lib/db/schema";
import {
  clampRating,
  isTestimonialStatus,
  shapeTestimonialReview,
  type TestimonialStatus,
} from "@/lib/testimonials";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const [row] = await db
      .select()
      .from(testimonialReviews)
      .where(eq(testimonialReviews.id, id))
      .limit(1);
    if (!row) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, review: shapeTestimonialReview(row) });
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const [existing] = await db
      .select()
      .from(testimonialReviews)
      .where(eq(testimonialReviews.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      authorName?: string;
      authorRole?: string | null;
      rating?: number;
      body?: string;
      status?: string;
      featured?: boolean;
      sortOrder?: number;
    };

    const patch: Partial<typeof testimonialReviews.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.authorName != null) {
      const authorName = String(body.authorName).trim();
      if (!authorName) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      patch.authorName = authorName;
    }
    if (body.authorRole !== undefined) {
      patch.authorRole = String(body.authorRole || "").trim() || null;
    }
    if (body.body != null) {
      const reviewBody = String(body.body).trim();
      if (!reviewBody) {
        return NextResponse.json(
          { error: "Review text is required" },
          { status: 400 },
        );
      }
      patch.body = reviewBody;
    }
    if (body.rating != null) {
      patch.rating = clampRating(body.rating);
    }
    if (body.featured != null) {
      patch.featured = Boolean(body.featured);
    }
    if (body.sortOrder != null) {
      patch.sortOrder = Math.max(0, Math.floor(Number(body.sortOrder) || 0));
    }
    if (body.status != null) {
      if (!isTestimonialStatus(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      patch.status = body.status as TestimonialStatus;
      if (body.status === "approved" && existing.status !== "approved") {
        patch.approvedByAdminId = admin.id;
        patch.approvedAt = new Date();
      }
      if (body.status !== "approved") {
        patch.approvedAt = null;
      }
    }

    const [updated] = await db
      .update(testimonialReviews)
      .set(patch)
      .where(eq(testimonialReviews.id, id))
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "testimonial.update",
      entityType: "testimonial_review",
      entityId: id,
      meta: {
        fromStatus: existing.status,
        toStatus: updated.status,
        fields: Object.keys(body),
      },
    });

    return NextResponse.json({
      ok: true,
      review: shapeTestimonialReview(updated),
    });
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  return withAdminApi(async ({ admin }) => {
    await ensureWalletSchema();
    const { id } = await ctx.params;
    const [existing] = await db
      .select()
      .from(testimonialReviews)
      .where(eq(testimonialReviews.id, id))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    await db.delete(testimonialReviews).where(eq(testimonialReviews.id, id));

    await writeAdminAudit({
      adminId: admin.id,
      action: "testimonial.delete",
      entityType: "testimonial_review",
      entityId: id,
      meta: { authorName: existing.authorName, status: existing.status },
    });

    return NextResponse.json({ ok: true });
  });
}
