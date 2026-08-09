import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  getLevelDef,
  normalizeKycLevel,
} from "@/lib/account-levels";
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

    const user = await db.query.users.findFirst({
      where: eq(users.id, submission.userId),
      columns: { id: true, kycLevel: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    const targetLevel = normalizeKycLevel(submission.targetLevel) || 1;
    const currentLevel = normalizeKycLevel(user.kycLevel);
    const approvedLevel =
      nextStatus === "verified"
        ? Math.max(currentLevel, targetLevel)
        : currentLevel;

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

    const userKycStatus =
      nextStatus === "pending"
        ? "pending"
        : nextStatus === "verified"
          ? "verified"
          : approvedLevel > 0
            ? "verified"
            : "rejected";

    await db
      .update(users)
      .set({
        kycStatus: userKycStatus,
        kycLevel: approvedLevel,
        updatedAt: new Date(),
      })
      .where(eq(users.id, submission.userId));

    const levelDef = getLevelDef(targetLevel);

    try {
      await createNotification({
        userId: submission.userId,
        title:
          nextStatus === "verified"
            ? `Level ${targetLevel} verified`
            : nextStatus === "rejected"
              ? `Level ${targetLevel} KYC rejected`
              : "KYC updated",
        body:
          nextStatus === "verified"
            ? `Your ${levelDef?.shortName || "KYC"} verification was approved. Daily limit updated.`
            : nextStatus === "rejected"
              ? body.reason!.trim()
              : "Your KYC submission status was updated.",
        type: "kyc",
        metadata: {
          href: "/settings/kyc",
          kycStatus: userKycStatus,
          kycLevel: approvedLevel,
          targetLevel,
        },
      });
    } catch (e) {
      console.error("[admin-kyc-notify]", e);
    }

    await writeAdminAudit({
      adminId: admin.id,
      action: `kyc.${nextStatus}`,
      entityType: "kyc_submission",
      entityId: id,
      meta: {
        userId: submission.userId,
        reason: body.reason || null,
        targetLevel,
        kycLevel: approvedLevel,
      },
    });

    return NextResponse.json({
      ok: true,
      submission: updated
        ? {
            id: updated.id,
            status: updated.status,
            statusLabel: titleCaseStatus(updated.status),
            targetLevel: updated.targetLevel,
            rejectionReason: updated.rejectionReason,
          }
        : null,
      user: { kycLevel: approvedLevel, kycStatus: userKycStatus },
    });
  });
}
