import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { kycSubmissions, users } from "@/lib/db/schema";

export const runtime = "nodejs";

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

    const latest = await db.query.kycSubmissions.findFirst({
      where: eq(kycSubmissions.userId, dbUser.id),
      orderBy: [desc(kycSubmissions.createdAt)],
    });

    return NextResponse.json({
      kycStatus: dbUser.kycStatus,
      submission: latest
        ? {
            id: latest.id,
            step: latest.step,
            idType: latest.idType,
            idNumber: latest.idNumber,
            idFrontUrl: latest.idFrontUrl,
            idBackUrl: latest.idBackUrl,
            selfieUrl: latest.selfieUrl,
            status: latest.status,
            rejectionReason: latest.rejectionReason,
          }
        : null,
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

    if (dbUser.kycStatus === "verified") {
      return NextResponse.json(
        { error: "KYC is already verified." },
        { status: 400 },
      );
    }

    const body = (await req.json()) as {
      idType?: string;
      idNumber?: string;
      idFrontUrl?: string;
      idBackUrl?: string;
      selfieUrl?: string;
      step?: number;
      submit?: boolean;
    };

    const latest = await db.query.kycSubmissions.findFirst({
      where: eq(kycSubmissions.userId, dbUser.id),
      orderBy: [desc(kycSubmissions.createdAt)],
    });

    const payload = {
      step: body.step ?? latest?.step ?? 1,
      idType: body.idType?.trim() || latest?.idType || null,
      idNumber: body.idNumber?.trim() || latest?.idNumber || null,
      idFrontUrl: body.idFrontUrl || latest?.idFrontUrl || null,
      idBackUrl: body.idBackUrl || latest?.idBackUrl || null,
      selfieUrl: body.selfieUrl || latest?.selfieUrl || null,
      status: body.submit ? ("pending" as const) : (latest?.status ?? "pending"),
      updatedAt: new Date(),
    };

    if (body.submit) {
      if (!payload.idType || !payload.idNumber || !payload.idFrontUrl) {
        return NextResponse.json(
          { error: "ID type, number, and front image are required." },
          { status: 400 },
        );
      }
    }

    let submission;
    if (latest && latest.status !== "verified") {
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
    }

    return NextResponse.json({
      ok: true,
      kycStatus: body.submit ? "pending" : dbUser.kycStatus,
      submission: {
        id: submission.id,
        step: submission.step,
        idType: submission.idType,
        idNumber: submission.idNumber,
        idFrontUrl: submission.idFrontUrl,
        idBackUrl: submission.idBackUrl,
        selfieUrl: submission.selfieUrl,
        status: submission.status,
        rejectionReason: submission.rejectionReason,
      },
    });
  } catch (error) {
    console.error("[kyc-post]", error);
    return NextResponse.json(
      { error: "Failed to save KYC submission" },
      { status: 500 },
    );
  }
}
