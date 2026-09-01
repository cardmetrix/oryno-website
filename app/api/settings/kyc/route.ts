import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import {
  getLevelDef,
  isBvnIdType,
  isNinIdType,
  isValidIdTypeForLevel,
  kycRulesForSubmission,
  nextKycLevel,
  normalizeKycLevel,
  type AccountLevelId,
} from "@/lib/account-levels";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { kycSubmissions, users } from "@/lib/db/schema";
import {
  uploadKycImage,
  type KycImagePayload,
} from "@/lib/kyc-upload";
import { createNotification } from "@/lib/notifications-service";

export const runtime = "nodejs";

function submissionDto(row: typeof kycSubmissions.$inferSelect) {
  return {
    id: row.id,
    step: row.step,
    targetLevel: row.targetLevel,
    idType: row.idType,
    idNumber: row.idNumber,
    idFrontUrl: row.idFrontUrl,
    idBackUrl: row.idBackUrl,
    selfieUrl: row.selfieUrl,
    status: row.status,
    rejectionReason: row.rejectionReason,
    submittedAt:
      row.updatedAt?.toISOString?.() ?? row.createdAt?.toISOString?.() ?? null,
    createdAt: row.createdAt?.toISOString?.() ?? null,
  };
}

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await ensureAppUser();
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const kycLevel = normalizeKycLevel(dbUser.kycLevel);
    const latest = await db.query.kycSubmissions.findFirst({
      where: eq(kycSubmissions.userId, dbUser.id),
      orderBy: [desc(kycSubmissions.createdAt)],
    });

    return NextResponse.json({
      kycStatus: dbUser.kycStatus,
      kycLevel,
      nextLevel: nextKycLevel(kycLevel),
      submission: latest ? submissionDto(latest) : null,
    });
  } catch (error) {
    console.error("[kyc-get]", error);
    return NextResponse.json({ error: "Failed to load KYC" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await ensureAppUser();
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const kycLevel = normalizeKycLevel(dbUser.kycLevel);
    if (kycLevel >= 3) {
      return NextResponse.json(
        { error: "You are already fully verified (Level 3)." },
        { status: 400 },
      );
    }

    if (dbUser.kycStatus === "pending") {
      return NextResponse.json(
        { error: "A KYC submission is already under review." },
        { status: 400 },
      );
    }

    const body = (await req.json()) as {
      targetLevel?: number;
      idType?: string;
      idNumber?: string;
      idFrontUrl?: string;
      idBackUrl?: string;
      selfieUrl?: string;
      idFrontImage?: KycImagePayload;
      idBackImage?: KycImagePayload;
      selfieImage?: KycImagePayload;
      step?: number;
      submit?: boolean;
    };

    const requested =
      body.targetLevel === 1 || body.targetLevel === 2 || body.targetLevel === 3
        ? (body.targetLevel as AccountLevelId)
        : nextKycLevel(kycLevel);

    if (!requested) {
      return NextResponse.json(
        { error: "No further KYC level available." },
        { status: 400 },
      );
    }

    if (requested !== kycLevel + 1 && !(kycLevel === 0 && requested === 1)) {
      return NextResponse.json(
        {
          error: `Submit Level ${kycLevel + 1} documents next.`,
        },
        { status: 400 },
      );
    }

    const levelDef = getLevelDef(requested);
    if (!levelDef) {
      return NextResponse.json({ error: "Invalid KYC level" }, { status: 400 });
    }

    const latest = await db.query.kycSubmissions.findFirst({
      where: eq(kycSubmissions.userId, dbUser.id),
      orderBy: [desc(kycSubmissions.createdAt)],
    });

    let uploadedFront: string | null = null;
    let uploadedBack: string | null = null;
    let uploadedSelfie: string | null = null;
    try {
      uploadedFront = await uploadKycImage(body.idFrontImage);
      uploadedBack = await uploadKycImage(body.idBackImage);
      uploadedSelfie = await uploadKycImage(body.selfieImage);
    } catch (uploadError) {
      return NextResponse.json(
        {
          error:
            uploadError instanceof Error
              ? uploadError.message
              : "Failed to upload KYC images",
        },
        { status: 400 },
      );
    }

    const defaultIdType = levelDef.kyc.idTypes[0];
    const idType = body.idType?.trim() || latest?.idType || defaultIdType;

    const payload = {
      step: body.step ?? latest?.step ?? requested,
      targetLevel: requested,
      idType,
      idNumber: body.idNumber?.trim() || latest?.idNumber || null,
      idFrontUrl:
        uploadedFront || body.idFrontUrl || latest?.idFrontUrl || null,
      idBackUrl: uploadedBack || body.idBackUrl || latest?.idBackUrl || null,
      selfieUrl: uploadedSelfie || body.selfieUrl || latest?.selfieUrl || null,
      status: body.submit ? ("pending" as const) : (latest?.status ?? "pending"),
      updatedAt: new Date(),
      rejectionReason: null as string | null,
    };

    if (body.submit) {
      const rules = kycRulesForSubmission(requested, payload.idType || "");
      if (!isValidIdTypeForLevel(requested, payload.idType)) {
        return NextResponse.json(
          {
            error: `Choose a valid document type for Level ${requested}: ${levelDef.kyc.idTypes.join(", ")}.`,
          },
          { status: 400 },
        );
      }
      if (rules.numberRequired && !payload.idNumber) {
        return NextResponse.json(
          { error: `${rules.numberLabel} is required.` },
          { status: 400 },
        );
      }
      if (
        isBvnIdType(payload.idType) &&
        payload.idNumber &&
        !/^\d{11}$/.test(payload.idNumber)
      ) {
        return NextResponse.json(
          { error: "BVN must be exactly 11 digits." },
          { status: 400 },
        );
      }
      if (
        isNinIdType(payload.idType) &&
        requested === 1 &&
        payload.idNumber &&
        !/^\d{11}$/.test(payload.idNumber)
      ) {
        return NextResponse.json(
          { error: "NIN must be exactly 11 digits." },
          { status: 400 },
        );
      }
      if (rules.frontRequired && !payload.idFrontUrl) {
        return NextResponse.json(
          { error: `${rules.frontLabel} is required.` },
          { status: 400 },
        );
      }
      if (rules.selfieRequired && !payload.selfieUrl) {
        return NextResponse.json(
          { error: "Selfie is required for this document type." },
          { status: 400 },
        );
      }
    }

    const canReuse =
      latest &&
      latest.status !== "verified" &&
      normalizeKycLevel(latest.targetLevel) === requested;

    let submission;
    if (canReuse) {
      const [updated] = await db
        .update(kycSubmissions)
        .set(payload)
        .where(eq(kycSubmissions.id, latest.id))
        .returning();
      submission = updated;
    } else {
      const [created] = await db
        .insert(kycSubmissions)
        .values({
          userId: dbUser.id,
          ...payload,
        })
        .returning();
      submission = created;
    }

    if (body.submit) {
      await db
        .update(users)
        .set({ kycStatus: "pending", updatedAt: new Date() })
        .where(eq(users.id, dbUser.id));

      try {
        await createNotification({
          userId: dbUser.id,
          title: `Level ${requested} KYC under review`,
          body: `Your ${levelDef.shortName} documents were received. We’ll notify you when Level ${requested} is approved.`,
          type: "kyc",
          metadata: {
            href: "/settings/kyc",
            kycStatus: "pending",
            targetLevel: requested,
            submissionId: submission.id,
          },
        });
      } catch (notifyError) {
        console.error("[kyc-submit-notify]", notifyError);
      }
    }

    return NextResponse.json({
      ok: true,
      kycStatus: body.submit ? "pending" : dbUser.kycStatus,
      kycLevel,
      nextLevel: nextKycLevel(kycLevel),
      submission: submissionDto(submission),
    });
  } catch (error) {
    console.error("[kyc-post]", error);
    return NextResponse.json(
      { error: "Failed to save KYC submission" },
      { status: 500 },
    );
  }
}
