import { ADMIN_SESSION_COOKIE } from "@/lib/admin/cookie";
import {
  ensureStaffAdminForAppUser,
  markAppUserAsAdminByEmail,
} from "@/lib/auth/user-role";
import { db } from "@/lib/db";
import { adminAuditLogs, admins, adminSessions, users } from "@/lib/db/schema";
import { currentUser } from "@clerk/nextjs/server";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";

export { ADMIN_SESSION_COOKIE };

export type AdminRole =
  | "super_admin"
  | "admin"
  | "support"
  | "finance"
  | "viewer";

export type AdminRecord = typeof admins.$inferSelect;

export type AdminSessionContext = {
  admin: AdminRecord;
  sessionId: string;
};

function adminPasscode() {
  return (process.env.ADMIN_PASSCODE || "").trim();
}

function pushEmails(raw: string, into: string[], seen: Set<string>) {
  for (const part of raw.split(/[,;\n|]+/)) {
    const email = part.trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    into.push(email);
  }
}

/**
 * All admin emails from env — unlimited count.
 * Reads (in order):
 * - ADMIN_BOOTSTRAP_EMAILS / ADMIN_EMAILS / ADMIN_BOOTSTRAP_EMAIL (comma-separated)
 * - ADMIN_EMAIL_1, ADMIN_EMAIL_2, … ADMIN_EMAIL_100
 */
export function bootstrapEmails(): string[] {
  const seen = new Set<string>();
  const list: string[] = [];

  pushEmails(process.env.ADMIN_BOOTSTRAP_EMAILS || "", list, seen);
  pushEmails(process.env.ADMIN_EMAILS || "", list, seen);
  pushEmails(process.env.ADMIN_BOOTSTRAP_EMAIL || "", list, seen);

  for (let i = 1; i <= 100; i++) {
    const key = `ADMIN_EMAIL_${i}`;
    const value = process.env[key];
    if (value) pushEmails(value, list, seen);
  }

  return list;
}

function isBootstrapEmail(email: string) {
  return bootstrapEmails().includes(email.trim().toLowerCase());
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
 * Upsert every env-listed admin email into `admins`.
 * First email in the env list → super_admin; the rest → admin.
 * Returns the row for the signing-in email.
 */
export async function ensureBootstrapAdmin(input: {
  email: string;
  name: string;
}): Promise<AdminRecord | null> {
  const email = input.email.trim().toLowerCase();
  if (!isBootstrapEmail(email)) return null;

  const allowlist = bootstrapEmails();
  if (!allowlist.length) return null;

  const existingRows = await db.select().from(admins);
  const byEmail = new Map(
    existingRows.map((row) => [row.email.toLowerCase(), row]),
  );

  for (let i = 0; i < allowlist.length; i++) {
    const adminEmail = allowlist[i];
    const role = i === 0 ? "super_admin" : "admin";
    const current = byEmail.get(adminEmail);

    if (current) {
      // Keep existing role unless still defaulting first env email to super_admin
      if (
        i === 0 &&
        current.role !== "super_admin" &&
        current.active &&
        !existingRows.some(
          (r) => r.role === "super_admin" && r.email.toLowerCase() !== adminEmail,
        )
      ) {
        const [updated] = await db
          .update(admins)
          .set({ role: "super_admin", updatedAt: new Date() })
          .where(eq(admins.id, current.id))
          .returning();
        if (updated) byEmail.set(adminEmail, updated);
      }
      continue;
    }

    const displayName =
      adminEmail === email
        ? input.name.slice(0, 160)
        : adminEmail.split("@")[0]?.slice(0, 160) || adminEmail;

    const [created] = await db
      .insert(admins)
      .values({
        name: displayName,
        email: adminEmail,
        role,
        active: true,
        lastLoginAt: adminEmail === email ? new Date() : null,
      })
      .returning();

    if (created) byEmail.set(adminEmail, created);
  }

  const self = byEmail.get(email);
  if (!self || !self.active) return null;

  // Keep app users.role in sync for every bootstrap email we touch
  for (const adminEmail of allowlist) {
    try {
      await markAppUserAsAdminByEmail(adminEmail);
    } catch (error) {
      console.error("[bootstrap-user-role]", adminEmail, error);
    }
  }

  if (self.email.toLowerCase() === email) {
    const [touched] = await db
      .update(admins)
      .set({
        name: input.name.slice(0, 160) || self.name,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(admins.id, self.id))
      .returning();
    return touched ?? self;
  }

  return self;
}

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

  let admin = await findAdminByEmail(clerk.email);

  // App users with role=admin are eligible even before a staff row exists
  if (!admin || !admin.active) {
    const appUser = await db.query.users.findFirst({
      where: eq(users.email, clerk.email),
      columns: { id: true, role: true, fullName: true, email: true },
    });

    if (appUser?.role === "admin") {
      admin = await ensureStaffAdminForAppUser({
        email: clerk.email,
        name: clerk.name || appUser.fullName,
      });
    }
  }

  if (!admin) {
    return { clerk, admin: null, reason: "not_admin" };
  }
  if (!admin.active) {
    return { clerk, admin: null, reason: "inactive" };
  }

  // Keep users.role aligned with active staff membership
  try {
    await markAppUserAsAdminByEmail(clerk.email);
  } catch (error) {
    console.error("[resolve-admin-user-role]", error);
  }

  return { clerk, admin };
}

/** True when this Clerk user is listed for bootstrap and not yet an admin. */
export async function canBootstrapAdmin(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!isBootstrapEmail(normalized)) return false;
  const existing = await findAdminByEmail(normalized);
  if (existing?.active) return false;

  const appUser = await db.query.users.findFirst({
    where: eq(users.email, normalized),
    columns: { role: true },
  });
  // Already an app-level admin — treat as eligible (login will sync staff row)
  if (appUser?.role === "admin") return false;

  return true;
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

  // Also require the session admin still matches the signed-in Clerk email
  const clerk = await clerkEmail();
  if (!clerk || clerk.email !== session.admin.email.toLowerCase()) {
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

export function assertAdminRole(
  admin: AdminRecord,
  allowed: AdminRole[] = [
    "super_admin",
    "admin",
    "support",
    "finance",
    "viewer",
  ],
) {
  return allowed.includes(admin.role as AdminRole);
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
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
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
