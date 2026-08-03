import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  resolveClerkUser,
  type ResolveClerkDebug,
} from "@/lib/auth/resolve-clerk-user";
import {
  mapClerkSdkUser,
  syncClerkUserToDb,
  type SyncedUser,
} from "@/lib/auth/sync-user";

export async function requireClerkAuth() {
  const { userId } = await auth();
  if (userId) return userId;

  const { user } = await resolveClerkUser();
  return user?.id ?? null;
}

async function resolveAndSync(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  request?: Request;
}): Promise<{ user: SyncedUser | null; debug?: ResolveClerkDebug }> {
  let clerkUser;
  let debug: ResolveClerkDebug | undefined;
  try {
    const resolved = await resolveClerkUser(options?.request);
    clerkUser = resolved.user;
    debug = resolved.debug;
  } catch (error) {
    console.error("[ensureAppUser-clerk]", error);
    return { user: null, debug };
  }
  if (!clerkUser) return { user: null, debug };

  const needsFullSync =
    Boolean(options?.forceCountry) ||
    Boolean(options?.touchLogin) ||
    Boolean(options?.countryCode);

  if (!needsFullSync) {
    try {
      const existing = await db.query.users.findFirst({
        where: eq(users.clerkId, clerkUser.id),
      });
      if (existing) return { user: existing, debug };
    } catch (error) {
      console.error("[ensureAppUser-lookup]", error);
    }
  }

  const synced = await syncClerkUserToDb(mapClerkSdkUser(clerkUser), {
    touchLogin: options?.touchLogin,
    countryCode: options?.countryCode,
    forceCountry: options?.forceCountry,
  });
  return { user: synced, debug };
}

/** Ensures the signed-in Clerk user exists in Postgres and returns the DB row. */
export async function ensureAppUser(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  request?: Request;
}): Promise<SyncedUser | null> {
  const { user } = await resolveAndSync(options);
  return user;
}

/** Same as ensureAppUser, plus Clerk bearer debug for mobile troubleshooting. */
export async function ensureAppUserDetailed(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  request?: Request;
}): Promise<{ user: SyncedUser | null; debug?: ResolveClerkDebug }> {
  return resolveAndSync(options);
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
