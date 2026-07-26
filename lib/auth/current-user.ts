import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  mapClerkSdkUser,
  syncClerkUserToDb,
  type SyncedUser,
} from "@/lib/auth/sync-user";

export async function requireClerkAuth() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }
  return userId;
}

/** Ensures the signed-in Clerk user exists in Postgres and returns the DB row. */
export async function ensureAppUser(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
}): Promise<SyncedUser | null> {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

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
