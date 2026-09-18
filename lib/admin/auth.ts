import { ADMIN_SESSION_COOKIE } from "@/lib/admin/cookie";
import { ensureStaffAdminForAppUser } from "@/lib/auth/user-role";
import { db } from "@/lib/db";
import { adminAuditLogs, admins, adminSessions, users } from "@/lib/db/schema";
import { currentUser } from "@clerk/nextjs/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";

export { ADMIN_SESSION_COOKIE };

/** Staff console role — only `admin` is used (no super_admin). */
export type AdminRole = "admin";

export type AdminRecord = typeof admins.$inferSelect;

export type AdminSessionContext = {
  admin: AdminRecord;
  sessionId: string;
};

function adminPasscode() {
  return (process.env.ADMIN_PASSCODE || "").trim();
}

function sessionHours() {
  const n = Number(process.env.ADMIN_SESSION_HOURS || "12");
  return Number.isFinite(n) && n > 0 ? n : 12;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isValidAdminPasscode(code: string) {
  const expected = adminPasscode();
  if (!expected) return false;
  return safeEqual(code.replace(/\s/g, ""), expected);
}

async function clerkEmail(): Promise<{
  clerkId: string;
  email: string;
  name: string;
} | null> {
  let clerkUser;
  try {
    clerkUser = await currentUser();
  } catch {
    return null;
  }
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    "";
  if (!email) return null;

  const name =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
    clerkUser.username ||
    email;

  return {
    clerkId: clerkUser.id,
    email: email.trim().toLowerCase(),
    name,
  };
}

export async function findAdminByEmail(email: string) {
  return (
    (await db.query.admins.findFirst({
      where: eq(admins.email, email.trim().toLowerCase()),
    })) ?? null
  );
}

/**
 * Admin access is driven only by `users.role === "admin"`.
 * No env allowlist / bootstrap emails.
 */
export async function resolveAdminForClerk(): Promise<{
  clerk: { clerkId: string; email: string; name: string };
  admin: AdminRecord | null;
  reason?: "not_signed_in" | "not_admin" | "inactive";
}> {
  const clerk = await clerkEmail();
  if (!clerk) {
    return {
      clerk: { clerkId: "", email: "", name: "" },
      admin: null,
      reason: "not_signed_in",
    };
  }

  const appUser = await db.query.users.findFirst({
    where: eq(users.email, clerk.email),
    columns: { id: true, role: true, fullName: true, email: true, status: true },
  });

  if (!appUser || appUser.role !== "admin") {
    return { clerk, admin: null, reason: "not_admin" };
  }

  if (appUser.status === "suspended" || appUser.status === "deleted") {
    return { clerk, admin: null, reason: "inactive" };
  }

  const admin = await ensureStaffAdminForAppUser({
    email: clerk.email,
    name: clerk.name || appUser.fullName,
  });

  if (!admin) {
    return { clerk, admin: null, reason: "not_admin" };
  }
  if (!admin.active) {
    return { clerk, admin: null, reason: "inactive" };
  }

  // Normalize legacy staff roles (super_admin, etc.) to admin
  if (admin.role !== "admin") {
    const [normalized] = await db
      .update(admins)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(admins.id, admin.id))
      .returning();
    return { clerk, admin: normalized ?? { ...admin, role: "admin" } };
  }

  return { clerk, admin };
}

/** Mobile / non-cookie clients send the raw session token here. */
export const ADMIN_SESSION_HEADER = "x-oryno-admin-session";

async function readAdminSessionToken(): Promise<string | null> {
  const jar = await cookies();
  const fromCookie = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (fromCookie) return fromCookie;

  const h = await headers();
  const fromHeader = h.get(ADMIN_SESSION_HEADER)?.trim();
  return fromHeader || null;
}

export async function getAdminSession(): Promise<AdminSessionContext | null> {
  const token = await readAdminSessionToken();
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.query.adminSessions.findFirst({
    where: and(
      eq(adminSessions.tokenHash, tokenHash),
      isNull(adminSessions.revokedAt),
      gt(adminSessions.expiresAt, new Date()),
    ),
    with: { admin: true },
  });

  if (!session?.admin || !session.admin.active) return null;

  const clerk = await clerkEmail();
  if (!clerk || clerk.email !== session.admin.email.toLowerCase()) {
    return null;
  }

  // Session only valid while app role is still admin
  const appUser = await db.query.users.findFirst({
    where: eq(users.email, clerk.email),
    columns: { role: true, status: true },
  });
  if (
    !appUser ||
    appUser.role !== "admin" ||
    appUser.status === "suspended" ||
    appUser.status === "deleted"
  ) {
    return null;
  }

  return { admin: session.admin, sessionId: session.id };
}

export async function requireAdminApi(): Promise<
  | { ok: true; admin: AdminRecord; sessionId: string }
  | { ok: false; status: 401 | 403; error: string }
> {
  const clerk = await clerkEmail();
  if (!clerk) {
    return { ok: false, status: 401, error: "Sign in required" };
  }

  const session = await getAdminSession();
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Admin session required. Enter the passcode.",
    };
  }

  if (session.admin.email.toLowerCase() !== clerk.email) {
    return { ok: false, status: 403, error: "Admin session mismatch" };
  }

  return {
    ok: true,
    admin: session.admin,
    sessionId: session.sessionId,
  };
}

/** Any authenticated admin can perform admin actions. */
export function assertAdminRole(_admin: AdminRecord, _allowed?: AdminRole[]) {
  return true;
}

async function clientMeta() {
  const h = await headers();
  return {
    ipAddress: (h.get("x-forwarded-for") || h.get("x-real-ip") || "")
      .split(",")[0]
      ?.trim()
      .slice(0, 64) || null,
    userAgent: (h.get("user-agent") || "").slice(0, 500) || null,
  };
}

export async function writeAdminAudit(input: {
  adminId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const meta = await clientMeta();
    await db.insert(adminAuditLogs).values({
      adminId: input.adminId,
      action: input.action.slice(0, 120),
      entityType: input.entityType?.slice(0, 80),
      entityId: input.entityId?.slice(0, 80),
      meta: input.meta,
      ipAddress: meta.ipAddress,
    });
  } catch (error) {
    console.error("[admin-audit]", error);
  }
}

export async function createAdminSession(admin: AdminRecord) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + sessionHours() * 60 * 60 * 1000);
  const meta = await clientMeta();

  const [row] = await db
    .insert(adminSessions)
    .values({
      adminId: admin.id,
      tokenHash,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })
    .returning();

  await db
    .update(admins)
    .set({
      role: "admin",
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(admins.id, admin.id));

  await writeAdminAudit({
    adminId: admin.id,
    action: "admin.login",
    entityType: "admin",
    entityId: admin.id,
  });

  return {
    token,
    expiresAt,
    sessionId: row?.id,
    maxAgeSec: sessionHours() * 60 * 60,
  };
}

export async function revokeAdminSession(token?: string | null) {
  const value = token || (await readAdminSessionToken());
  if (!value) return;

  const tokenHash = hashToken(value);
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.tokenHash, tokenHash));
}

export function adminCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
