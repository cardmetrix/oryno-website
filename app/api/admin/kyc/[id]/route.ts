import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import { kycSubmissions, users } from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withAdminApi(async ({ admin }) => {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      action?: "approve" | "reject";
      status?: "verified" | "rejected" | "pending";
      reason?: string;
    };

    const submission = await db.query.kycSubmissions.findFirst({
      where: eq(kycSubmissions.id, id),
    });
    if (!submission) {
      return NextResponse.json(
        { error: "KYC submission not found" },
        { status: 404 },
      );
    }

    let nextStatus: "verified" | "rejected" | "pending" = "pending";
    if (body.action === "approve" || body.status === "verified") {
      nextStatus = "verified";
    } else if (body.action === "reject" || body.status === "rejected") {
      nextStatus = "rejected";
    } else if (body.status === "pending") {
      nextStatus = "pending";
    } else {
      return NextResponse.json(
        { error: "Use action approve/reject or status verified/rejected" },
        { status: 400 },
      );
    }

    if (nextStatus === "rejected" && !body.reason?.trim()) {
      return NextResponse.json(
        { error: "Enter a rejection reason" },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(kycSubmissions)
      .set({
        status: nextStatus,
        rejectionReason:
          nextStatus === "rejected" ? body.reason!.trim().slice(0, 500) : null,
        reviewedByAdminId: admin.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(kycSubmissions.id, id))
      .returning();

    await db
      .update(users)
      .set({
        kycStatus: nextStatus === "pending" ? "pending" : nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(users.id, submission.userId));

    try {
      await createNotification({
        userId: submission.userId,
        title:
          nextStatus === "verified"
            ? "KYC verified"
            : nextStatus === "rejected"
              ? "KYC rejected"
              : "KYC updated",
        body:
          nextStatus === "verified"
            ? "Your identity verification was approved."
            : nextStatus === "rejected"
              ? body.reason!.trim()
              : "Your KYC submission status was updated.",
        type: "kyc",
        metadata: { href: "/settings/kyc", kycStatus: nextStatus },
      });
    } catch (e) {
      console.error("[admin-kyc-notify]", e);
    }

    await writeAdminAudit({
      adminId: admin.id,
      action: `kyc.${nextStatus}`,
      entityType: "kyc_submission",
      entityId: id,
      meta: { userId: submission.userId, reason: body.reason || null },
    });

    return NextResponse.json({
      ok: true,
      submission: updated
        ? {
            id: updated.id,
            status: updated.status,
            statusLabel: titleCaseStatus(updated.status),
            rejectionReason: updated.rejectionReason,
          }
        : null,
    });
  });
}
