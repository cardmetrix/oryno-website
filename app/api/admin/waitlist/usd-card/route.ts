import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { usdVirtualCardWaitlist, users } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const rows = await db
      .select({
        id: usdVirtualCardWaitlist.id,
        email: usdVirtualCardWaitlist.email,
        countryCode: usdVirtualCardWaitlist.countryCode,
        provider: usdVirtualCardWaitlist.provider,
        createdAt: usdVirtualCardWaitlist.createdAt,
        userName: users.fullName,
        userId: usdVirtualCardWaitlist.userId,
      })
      .from(usdVirtualCardWaitlist)
      .leftJoin(users, eq(usdVirtualCardWaitlist.userId, users.id))
      .orderBy(desc(usdVirtualCardWaitlist.createdAt))
      .limit(500);

    return NextResponse.json({
      count: rows.length,
      entries: rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.userName || "—",
        countryCode: row.countryCode,
        provider: row.provider,
        joinedAt: row.createdAt.toISOString(),
      })),
    });
  });
}
