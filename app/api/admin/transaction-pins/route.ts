import { desc, eq, ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { userSecurity, users } from "@/lib/db/schema";
import { notifyTransactionPinChanged } from "@/lib/notify/pin-events";
import { decryptPin } from "@/lib/security/pin-crypto";
import {
  adminClearTransactionPin,
  adminSetTransactionPin,
  adminUnlockTransactionPin,
  TransactionPinError,
} from "@/lib/security/transaction-pin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();
    const pinFilter = (searchParams.get("pin") || "").trim();

    const rows = await db
      .select({
        id: users.id,
        name: users.fullName,
        email: users.email,
        phone: users.phone,
        username: users.username,
        status: users.status,
        countryCode: users.countryCode,
        pinHash: userSecurity.pinHash,
        pinEncrypted: userSecurity.pinEncrypted,
        failedPinAttempts: userSecurity.failedPinAttempts,
        lockedUntil: userSecurity.lockedUntil,
        pinUpdatedAt: userSecurity.updatedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userSecurity, eq(userSecurity.userId, users.id))
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
      .limit(300);

    const now = Date.now();
    let mapped = rows.map((u) => {
      const hasPin = Boolean(u.pinHash);
      const locked =
        u.lockedUntil != null && new Date(u.lockedUntil).getTime() > now;
      const pin = decryptPin(u.pinEncrypted);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        username: u.username,
        countryCode: u.countryCode,
        status: u.status,
        statusLabel: titleCaseStatus(u.status),
        hasPin,
        pin: hasPin ? pin : null,
        pinLabel: hasPin ? pin || "•••• (legacy)" : "Not set",
        failedPinAttempts: u.failedPinAttempts ?? 0,
        lockedUntil: u.lockedUntil
          ? new Date(u.lockedUntil).toISOString()
          : null,
        isLocked: locked,
        pinUpdatedAt: u.pinUpdatedAt
          ? new Date(u.pinUpdatedAt).toISOString()
          : null,
        createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      };
    });

    if (pinFilter === "set") mapped = mapped.filter((u) => u.hasPin);
    if (pinFilter === "missing") mapped = mapped.filter((u) => !u.hasPin);
    if (pinFilter === "locked") mapped = mapped.filter((u) => u.isLocked);

    const stats = {
      total: mapped.length,
      withPin: mapped.filter((u) => u.hasPin).length,
      withoutPin: mapped.filter((u) => !u.hasPin).length,
      locked: mapped.filter((u) => u.isLocked).length,
    };

    return NextResponse.json({ users: mapped, stats });
  });
}

export async function PATCH(req: Request) {
  return withAdminApi(async () => {
    await ensureWalletSchema();
    const body = (await req.json()) as {
      userId?: string;
      action?: "set" | "clear" | "unlock";
      pin?: string;
      notify?: boolean;
    };

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }
    if (!body.action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, body.userId),
      columns: { id: true, fullName: true, email: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    try {
      if (body.action === "set") {
        if (!body.pin) {
          return NextResponse.json(
            { error: "PIN is required" },
            { status: 400 },
          );
        }
        const had = await db.query.userSecurity.findFirst({
          where: eq(userSecurity.userId, user.id),
          columns: { pinHash: true },
        });
        await adminSetTransactionPin(user.id, body.pin);
        if (body.notify !== false) {
          try {
            await notifyTransactionPinChanged({
              userId: user.id,
              fullName: user.fullName,
              created: !had?.pinHash,
            });
          } catch (notifyError) {
            console.error("[admin-pin-notify]", notifyError);
          }
        }
      } else if (body.action === "clear") {
        await adminClearTransactionPin(user.id);
      } else if (body.action === "unlock") {
        await adminUnlockTransactionPin(user.id);
      } else {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
      }
    } catch (error) {
      if (error instanceof TransactionPinError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }
      throw error;
    }

    const security = await db.query.userSecurity.findFirst({
      where: eq(userSecurity.userId, user.id),
    });
    const pin = decryptPin(security?.pinEncrypted);
    const locked =
      security?.lockedUntil != null &&
      security.lockedUntil.getTime() > Date.now();

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        hasPin: Boolean(security?.pinHash),
        pin: security?.pinHash ? pin : null,
        failedPinAttempts: security?.failedPinAttempts ?? 0,
        lockedUntil: security?.lockedUntil?.toISOString() ?? null,
        isLocked: locked,
      },
    });
  });
}
