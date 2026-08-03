import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveClerkUser } from "@/lib/auth/resolve-clerk-user";
import {
  mapClerkSdkUser,
  syncClerkUserToDb,
  type SyncedUser,
} from "@/lib/auth/sync-user";

export async function requireClerkAuth() {
  const { userId } = await auth();
  if (userId) return userId;

  const user = await resolveClerkUser();
  return user?.id ?? null;
}

/** Ensures the signed-in Clerk user exists in Postgres and returns the DB row. */
export async function ensureAppUser(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
}): Promise<SyncedUser | null> {
  let clerkUser;
  try {
    clerkUser = await resolveClerkUser();
  } catch (error) {
    console.error("[ensureAppUser-clerk]", error);
    return null;
  }
  if (!clerkUser) return null;

  const needsFullSync =
    Boolean(options?.forceCountry) ||
    Boolean(options?.touchLogin) ||
    Boolean(options?.countryCode);

  // Fast path for dashboard fan-out (wallet / notifications / country / settings)
  // so parallel GETs don't all rewrite users/wallets/countries.
  if (!needsFullSync) {
    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkUser.id),
      });
      if (existing) return existing;
    } catch (error) {
      console.error("[ensureAppUser-lookup]", error);
      // Fall through to full sync
    }
  }

  return syncClerkUserToDb(mapClerkSdkUser(clerkUser), {
    touchLogin: options?.touchLogin,
    countryCode: options?.countryCode,
    forceCountry: options?.forceCountry,
  });
}

export async function getAppUserByClerkId(
  clerkId: string,
): Promise<SyncedUser | null> {
  return (
    (await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    })) ?? null
  );
}
