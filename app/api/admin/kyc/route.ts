import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { countries, kycSubmissions, users } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") || "").trim();

    const rows = await db
      .select({
        id: kycSubmissions.id,
        status: kycSubmissions.status,
        idType: kycSubmissions.idType,
        idNumber: kycSubmissions.idNumber,
        idFrontUrl: kycSubmissions.idFrontUrl,
        idBackUrl: kycSubmissions.idBackUrl,
        selfieUrl: kycSubmissions.selfieUrl,
        rejectionReason: kycSubmissions.rejectionReason,
        reviewedAt: kycSubmissions.reviewedAt,
        createdAt: kycSubmissions.createdAt,
        updatedAt: kycSubmissions.updatedAt,
        userId: users.id,
        userName: users.fullName,
        userEmail: users.email,
        userKyc: users.kycStatus,
        countryCode: users.countryCode,
        countryName: countries.name,
      })
      .from(kycSubmissions)
      .innerJoin(users, eq(kycSubmissions.userId, users.id))
      .leftJoin(countries, eq(users.countryCode, countries.code))
      .where(
        status
          ? eq(
              kycSubmissions.status,
              status as "pending" | "verified" | "rejected" | "unverified",
            )
          : undefined,
      )
      .orderBy(desc(kycSubmissions.createdAt))
      .limit(150);

    const pendingCount = rows.filter((r) => r.status === "pending").length;

    return NextResponse.json({
      ok: true,
      pendingCount,
      submissions: rows.map((r) => ({
        id: r.id,
        status: r.status,
        statusLabel: titleCaseStatus(r.status),
        idType: r.idType,
        idNumber: r.idNumber,
        idFrontUrl: r.idFrontUrl,
        idBackUrl: r.idBackUrl,
        selfieUrl: r.selfieUrl,
        rejectionReason: r.rejectionReason,
        reviewedAt: r.reviewedAt?.toISOString?.() ?? null,
        createdAt: r.createdAt?.toISOString?.() ?? null,
        updatedAt: r.updatedAt?.toISOString?.() ?? null,
        user: {
          id: r.userId,
          name: r.userName,
          email: r.userEmail,
          kyc: r.userKyc,
          country: r.countryName || r.countryCode || "—",
        },
      })),
    });
  });
}
