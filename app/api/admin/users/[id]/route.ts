import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import { db } from "@/lib/db";
import {
  countries,
  kycSubmissions,
  transactions,
  users,
  wallets,
} from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

type UserStatus = "active" | "suspended" | "deleted";
type KycStatus = "unverified" | "pending" | "verified" | "rejected";
type WalletStatus = "healthy" | "frozen" | "closed";

function isUserStatus(v: string): v is UserStatus {
  return v === "active" || v === "suspended" || v === "deleted";
}
function isKycStatus(v: string): v is KycStatus {
  return (
    v === "unverified" ||
    v === "pending" ||
    v === "verified" ||
    v === "rejected"
  );
}
function isWalletStatus(v: string): v is WalletStatus {
  return v === "healthy" || v === "frozen" || v === "closed";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withAdminApi(async () => {
    const { id } = await ctx.params;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const country = user.countryCode
      ? await db.query.countries.findFirst({
          where: eq(countries.code, user.countryCode),
        })
      : null;

    const userWallets = await db
      .select()
      .from(wallets)
      .where(eq(wallets.userId, id));

    const latestKyc = await db.query.kycSubmissions.findFirst({
      where: eq(kycSubmissions.userId, id),
      orderBy: [desc(kycSubmissions.createdAt)],
    });

    const recentTx = await db
      .select({
        id: transactions.id,
        title: transactions.title,
        amount: transactions.amount,
        currency: transactions.currency,
        status: transactions.status,
        type: transactions.type,
        category: transactions.category,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.userId, id))
      .orderBy(desc(transactions.createdAt))
      .limit(15);

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        phone: user.phone,
        username: user.username,
        avatarUrl: user.avatarUrl,
        countryCode: user.countryCode,
        country: country?.name || user.countryCode || "—",
        status: user.status,
        statusLabel: titleCaseStatus(user.status),
        kyc: user.kycStatus,
        kycLevel: user.kycLevel,
        kycLabel: `L${user.kycLevel} · ${titleCaseStatus(user.kycStatus)}`,
        lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
        createdAt: user.createdAt?.toISOString?.() ?? null,
        emailVerifiedAt: user.emailVerifiedAt?.toISOString?.() ?? null,
      },
      wallets: userWallets.map((w) => ({
        id: w.id,
        currency: w.currency,
        balance: w.balance,
        balanceFormatted: formatMoney(w.balance, w.currency),
        status: w.status,
        statusLabel: titleCaseStatus(w.status),
        isPrimary: w.isPrimary,
      })),
      kycSubmission: latestKyc
        ? {
            id: latestKyc.id,
            status: latestKyc.status,
            statusLabel: titleCaseStatus(latestKyc.status),
            targetLevel: latestKyc.targetLevel,
            idType: latestKyc.idType,
            idNumber: latestKyc.idNumber,
            idFrontUrl: latestKyc.idFrontUrl,
            idBackUrl: latestKyc.idBackUrl,
            selfieUrl: latestKyc.selfieUrl,
            rejectionReason: latestKyc.rejectionReason,
            reviewedAt: latestKyc.reviewedAt?.toISOString?.() ?? null,
            createdAt: latestKyc.createdAt?.toISOString?.() ?? null,
          }
        : null,
      transactions: recentTx.map((t) => ({
        id: t.id,
        title: t.title,
        amount: formatMoney(t.amount, t.currency),
        status: titleCaseStatus(t.status),
        type: t.type,
        category: titleCaseStatus(t.category),
        when: t.createdAt
          ? new Date(t.createdAt).toLocaleString("en-NG")
          : "—",
      })),
    });
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return withAdminApi(async ({ admin }) => {
    const { id } = await ctx.params;
    const user = await db.query.users.findFirst({
      where: eq(users.id, id),
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      status?: string;
      kycStatus?: string;
      kycLevel?: number;
      fullName?: string;
      phone?: string | null;
      countryCode?: string | null;
      walletId?: string;
      walletStatus?: string;
      freezeAllWallets?: boolean;
      unfreezeAllWallets?: boolean;
      notify?: boolean;
      note?: string;
    };

    const userPatch: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.status != null) {
      if (!isUserStatus(body.status)) {
        return NextResponse.json(
          { error: "Invalid user status" },
          { status: 400 },
        );
      }
      userPatch.status = body.status;
    }

    if (body.kycStatus != null) {
      if (!isKycStatus(body.kycStatus)) {
        return NextResponse.json(
          { error: "Invalid KYC status" },
          { status: 400 },
        );
      }
      userPatch.kycStatus = body.kycStatus;
      if (body.kycStatus === "verified" && body.kycLevel == null) {
        userPatch.kycLevel = Math.max(user.kycLevel || 0, 1);
      }
      if (body.kycStatus === "unverified" || body.kycStatus === "rejected") {
        if (body.kycLevel == null) userPatch.kycLevel = 0;
      }
    }

    if (body.kycLevel != null) {
      const level = Number(body.kycLevel);
      if (![0, 1, 2, 3].includes(level)) {
        return NextResponse.json(
          { error: "kycLevel must be 0, 1, 2, or 3" },
          { status: 400 },
        );
      }
      userPatch.kycLevel = level;
      if (level > 0 && body.kycStatus == null) {
        userPatch.kycStatus = "verified";
      }
    }

    if (typeof body.fullName === "string" && body.fullName.trim()) {
      userPatch.fullName = body.fullName.trim().slice(0, 160);
    }
    if (body.phone !== undefined) {
      userPatch.phone = body.phone ? String(body.phone).trim().slice(0, 32) : null;
    }
    if (body.countryCode !== undefined) {
      userPatch.countryCode = body.countryCode
        ? String(body.countryCode).trim().toUpperCase().slice(0, 2)
        : null;
    }

    const [updated] = await db
      .update(users)
      .set(userPatch)
      .where(eq(users.id, id))
      .returning();

    if (body.freezeAllWallets) {
      await db
        .update(wallets)
        .set({ status: "frozen", updatedAt: new Date() })
        .where(eq(wallets.userId, id));
    }
    if (body.unfreezeAllWallets) {
      await db
        .update(wallets)
        .set({ status: "healthy", updatedAt: new Date() })
        .where(eq(wallets.userId, id));
    }
    if (body.walletId && body.walletStatus) {
      if (!isWalletStatus(body.walletStatus)) {
        return NextResponse.json(
          { error: "Invalid wallet status" },
          { status: 400 },
        );
      }
      await db
        .update(wallets)
        .set({ status: body.walletStatus, updatedAt: new Date() })
        .where(eq(wallets.id, body.walletId));
    }

    // Keep latest KYC submission in sync when admin sets KYC on user
    if (body.kycStatus === "verified" || body.kycStatus === "rejected") {
      const latest = await db.query.kycSubmissions.findFirst({
        where: eq(kycSubmissions.userId, id),
        orderBy: [desc(kycSubmissions.createdAt)],
      });
      if (latest) {
        await db
          .update(kycSubmissions)
          .set({
            status: body.kycStatus,
            rejectionReason:
              body.kycStatus === "rejected"
                ? body.note?.trim() || latest.rejectionReason || "Rejected by admin"
                : null,
            reviewedByAdminId: admin.id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(kycSubmissions.id, latest.id));
      }
    }

    if (body.notify !== false) {
      try {
        if (body.status === "suspended") {
          await createNotification({
            userId: id,
            title: "Account suspended",
            body:
              body.note?.trim() ||
              "Your ORYNO account has been suspended. Contact support for help.",
            type: "system",
          });
        } else if (body.status === "active" && user.status !== "active") {
          await createNotification({
            userId: id,
            title: "Account reactivated",
            body: "Your ORYNO account is active again.",
            type: "system",
          });
        } else if (body.kycStatus === "verified") {
          await createNotification({
            userId: id,
            title: "KYC verified",
            body: "Your identity verification was approved.",
            type: "kyc",
            metadata: { href: "/settings/kyc", kycStatus: "verified" },
          });
        } else if (body.kycStatus === "rejected") {
          await createNotification({
            userId: id,
            title: "KYC rejected",
            body:
              body.note?.trim() ||
              "Your identity verification was rejected. Please resubmit.",
            type: "kyc",
            metadata: { href: "/settings/kyc", kycStatus: "rejected" },
          });
        }
      } catch (e) {
        console.error("[admin-user-notify]", e);
      }
    }

    await writeAdminAudit({
      adminId: admin.id,
      action: "user.update",
      entityType: "user",
      entityId: id,
      meta: { keys: Object.keys(body) },
    });

    return NextResponse.json({
      ok: true,
      user: updated
        ? {
            id: updated.id,
            name: updated.fullName,
            email: updated.email,
            status: updated.status,
            statusLabel: titleCaseStatus(updated.status),
            kyc: updated.kycStatus,
            kycLevel: updated.kycLevel,
            kycLabel: `L${updated.kycLevel} · ${titleCaseStatus(updated.kycStatus)}`,
          }
        : null,
    });
  });
}
