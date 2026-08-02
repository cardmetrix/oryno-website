import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { referralCodes, users } from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const rows = await db
      .select({
        code: referralCodes.code,
        joins: referralCodes.joinsCount,
        earnings: referralCodes.earnings,
        status: referralCodes.status,
        owner: users.fullName,
        currency: users.countryCode,
      })
      .from(referralCodes)
      .innerJoin(users, eq(referralCodes.userId, users.id))
      .orderBy(desc(referralCodes.joinsCount))
      .limit(100);

    const totalJoins = rows.reduce((s, r) => s + (r.joins || 0), 0);
    const totalEarnings = rows.reduce(
      (s, r) => s + Number(r.earnings || 0),
      0,
    );

    return NextResponse.json({
      ok: true,
      stats: {
        codes: rows.length,
        joins: totalJoins,
        earnings: formatMoney(totalEarnings, "NGN"),
      },
      referrals: rows.map((r) => ({
        code: r.code,
        owner: r.owner,
        joins: r.joins,
        earnings: formatMoney(r.earnings || 0, "NGN"),
        status: titleCaseStatus(r.status),
      })),
    });
  });
}
