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
    const status = (searchParams.get("status") || "").trim();
    const role = (searchParams.get("role") || "").trim();

    const rows = await db
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        phone: users.phone,
        username: users.username,
        status: users.status,
        role: users.role,
        countryCode: users.countryCode,
        countryName: countries.name,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(countries, eq(users.countryCode, countries.code))
      .where(
        q
          ? or(
              ilike(users.fullName, `%${q}%`),
              ilike(users.email, `%${q}%`),
              ilike(users.username, `%${q}%`),
              ilike(users.phone, `%${q}%`),
            )
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(200);

    const walletRows = await db
      .select({
        userId: wallets.userId,
        balance: wallets.balance,
        currency: wallets.currency,
        status: wallets.status,
        isPrimary: wallets.isPrimary,
      })
      .from(wallets);

    const walletsByUser = new Map<
      string,
      Array<{
        balance: string;
        currency: string;
        status: string;
        isPrimary: boolean;
        balanceFormatted: string;
      }>
    >();

    for (const w of walletRows) {
      const list = walletsByUser.get(w.userId) || [];
      list.push({
        balance: w.balance,
        currency: w.currency,
        status: w.status,
        isPrimary: w.isPrimary,
        balanceFormatted: formatMoney(w.balance, w.currency),
      });
      walletsByUser.set(w.userId, list);
    }

    let mapped = rows.map((u) => {
      const userWallets = (walletsByUser.get(u.id) || []).sort((a, b) =>
        a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1,
      );
      const primary = userWallets[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        username: u.username,
        country: u.countryName || u.countryCode || "—",
        countryCode: u.countryCode,
        status: u.status,
        statusLabel: titleCaseStatus(u.status),
        role: u.role === "admin" ? "admin" : "user",
        roleLabel: u.role === "admin" ? "Admin" : "User",
        balance: primary
          ? primary.balanceFormatted
          : formatMoney(0, "NGN"),
        balances: userWallets,
        lastLoginAt: u.lastLoginAt?.toISOString?.() ?? null,
        createdAt: u.createdAt?.toISOString?.() ?? null,
      };
    });

    if (status) {
      mapped = mapped.filter((u) => u.status === status);
    }
    if (role === "user" || role === "admin") {
      mapped = mapped.filter((u) => u.role === role);
    }

    return NextResponse.json({ ok: true, users: mapped });
  });
}
