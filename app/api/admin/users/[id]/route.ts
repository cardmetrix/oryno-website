import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { assertAdminRole, writeAdminAudit } from "@/lib/admin/auth";
import { isAppUserRole, setAppUserRole } from "@/lib/auth/user-role";
import { db } from "@/lib/db";
import {
  countries,
  transactions,
  users,
  wallets,
} from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

type UserStatus = "active" | "suspended" | "deleted";
type WalletStatus = "healthy" | "frozen" | "closed";

function isUserStatus(v: string): v is UserStatus {
  return v === "active" || v === "suspended" || v === "deleted";
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
        role: user.role === "admin" ? "admin" : "user",
        roleLabel: user.role === "admin" ? "Admin" : "User",
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
      role?: string;
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

    if (body.role != null) {
      if (!isAppUserRole(body.role)) {
        return NextResponse.json(
          { error: "Invalid role. Use user or admin." },
          { status: 400 },
        );
      }
      if (!assertAdminRole(admin)) {
        return NextResponse.json(
          { error: "Only admins can change user roles" },
          { status: 403 },
        );
      }
      if (body.role === "user" && admin.email.toLowerCase() === user.email.toLowerCase()) {
        return NextResponse.json(
          { error: "You cannot remove your own admin role" },
          { status: 400 },
        );
      }

      const roleUpdated = await setAppUserRole({
        userId: id,
        role: body.role,
      });

      if (body.notify !== false) {
        try {
          await createNotification({
            userId: id,
            title:
              body.role === "admin"
                ? "Admin access granted"
                : "Admin access removed",
            body:
              body.role === "admin"
                ? "Your account can unlock the ORYNO admin console with the admin passcode."
                : "Your account no longer has admin console access.",
            type: "system",
          });
        } catch (e) {
          console.error("[admin-user-role-notify]", e);
        }
      }

      await writeAdminAudit({
        adminId: admin.id,
        action: "user.role.update",
        entityType: "user",
        entityId: id,
        meta: { role: body.role },
      });

      // Role-only update — return early if nothing else was sent
      const otherKeys = Object.keys(body).filter(
        (k) => k !== "role" && k !== "notify" && k !== "note",
      );
      if (otherKeys.length === 0) {
        return NextResponse.json({
          ok: true,
          user: roleUpdated
            ? {
                id: roleUpdated.id,
                name: roleUpdated.fullName,
                email: roleUpdated.email,
                status: roleUpdated.status,
                statusLabel: titleCaseStatus(roleUpdated.status),
                role: roleUpdated.role === "admin" ? "admin" : "user",
                roleLabel: roleUpdated.role === "admin" ? "Admin" : "User",
              }
            : null,
        });
      }
    }

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
            role: updated.role === "admin" ? "admin" : "user",
            roleLabel: updated.role === "admin" ? "Admin" : "User",
          }
        : null,
    });
  });
}
