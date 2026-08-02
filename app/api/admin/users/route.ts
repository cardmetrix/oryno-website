import { desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { countries, users, wallets } from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const rows = await db
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        status: users.status,
        kyc: users.kycStatus,
        countryCode: users.countryCode,
        countryName: countries.name,
      })
      .from(users)
      .leftJoin(countries, eq(users.countryCode, countries.code))
      .where(
        q
          ? or(
              ilike(users.fullName, `%${q}%`),
              ilike(users.email, `%${q}%`),
              ilike(users.username, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(100);

    const walletRows = await db
      .select({
        userId: wallets.userId,
        balance: wallets.balance,
        currency: wallets.currency,
        isPrimary: wallets.isPrimary,
        createdAt: wallets.createdAt,
      })
      .from(wallets);

    const walletByUser = new Map<
      string,
      { balance: string; currency: string }
    >();
    for (const w of walletRows) {
      const existing = walletByUser.get(w.userId);
      if (!existing || w.isPrimary) {
        walletByUser.set(w.userId, {
          balance: w.balance,
          currency: w.currency,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      users: rows.map((u) => {
        const wallet = walletByUser.get(u.id);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          country: u.countryName || u.countryCode || "—",
          status: titleCaseStatus(u.status),
          kyc: titleCaseStatus(u.kyc),
          balance: formatMoney(
            wallet?.balance || 0,
            wallet?.currency || "NGN",
          ),
        };
      }),
    });
  });
}
