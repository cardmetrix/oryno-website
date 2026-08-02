import { desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { users, wallets } from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const rows = await db
      .select({
        id: wallets.id,
        currency: wallets.currency,
        balance: wallets.balance,
        status: wallets.status,
        isPrimary: wallets.isPrimary,
        userName: users.fullName,
        userEmail: users.email,
      })
      .from(wallets)
      .innerJoin(users, eq(wallets.userId, users.id))
      .where(
        q
          ? or(
              ilike(users.fullName, `%${q}%`),
              ilike(users.email, `%${q}%`),
              ilike(wallets.currency, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(wallets.updatedAt))
      .limit(150);

    return NextResponse.json({
      ok: true,
      wallets: rows.map((w) => ({
        id: w.id,
        user: w.userName,
        email: w.userEmail,
        currency: w.currency,
        balance: formatMoney(w.balance, w.currency),
        status: titleCaseStatus(w.status),
        primary: w.isPrimary,
      })),
    });
  });
}
