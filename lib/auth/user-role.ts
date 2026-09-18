import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { admins, users } from "@/lib/db/schema";

export type AppUserRole = "user" | "admin";

export function isAppUserRole(value: unknown): value is AppUserRole {
  return value === "user" || value === "admin";
}

/**
 * Keep `users.role` and the staff `admins` table in sync.
 * Promoting creates/reactivates an admin row; demoting deactivates it.
 */
export async function setAppUserRole(input: {
  userId: string;
  role: AppUserRole;
  /** Staff console role when promoting (default admin). */
  staffRole?: "super_admin" | "admin" | "support" | "finance" | "viewer";
}) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, input.userId),
  });
  if (!user) throw new Error("User not found");

  const email = user.email.trim().toLowerCase();
  const now = new Date();

  const [updated] = await db
    .update(users)
    .set({ role: input.role, updatedAt: now })
    .where(eq(users.id, input.userId))
    .returning();

  const existingAdmin = await db.query.admins.findFirst({
    where: eq(admins.email, email),
  });

  if (input.role === "admin") {
    if (existingAdmin) {
      await db
        .update(admins)
        .set({
          active: true,
          name: user.fullName.slice(0, 160) || existingAdmin.name,
          updatedAt: now,
        })
        .where(eq(admins.id, existingAdmin.id));
    } else {
      await db.insert(admins).values({
        name: user.fullName.slice(0, 160) || email.split("@")[0] || email,
        email,
        role: input.staffRole ?? "admin",
        active: true,
      });
    }
  } else if (existingAdmin?.active) {
    await db
      .update(admins)
      .set({ active: false, updatedAt: now })
      .where(eq(admins.id, existingAdmin.id));
  }

  return updated;
}

/** Ensure an app user marked admin has a matching active staff row. */
export async function ensureStaffAdminForAppUser(input: {
  email: string;
  name: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.query.admins.findFirst({
    where: eq(admins.email, email),
  });

  if (existing) {
    if (!existing.active) {
      const [reactivated] = await db
        .update(admins)
        .set({
          active: true,
          name: input.name.slice(0, 160) || existing.name,
          updatedAt: new Date(),
        })
        .where(eq(admins.id, existing.id))
        .returning();
      return reactivated ?? existing;
    }
    return existing;
  }

  const [created] = await db
    .insert(admins)
    .values({
      name: input.name.slice(0, 160) || email.split("@")[0] || email,
      email,
      role: "admin",
      active: true,
    })
    .returning();

  return created ?? null;
}

/** Mark the matching app user as admin (used by env bootstrap). */
export async function markAppUserAsAdminByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  await db
    .update(users)
    .set({ role: "admin", updatedAt: new Date() })
    .where(eq(users.email, normalized));
}
