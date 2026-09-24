import { cache } from "react";
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
import { resolveLanguageForCountry } from "@/lib/country";
import { countryOverrideForUser } from "@/lib/country-overrides";
import { ensurePrimaryWallet } from "@/lib/wallet";

const USER_LOOKUP_TTL_MS = 8_000;
const userLookupCache = new Map<string, { user: SyncedUser; expires: number }>();
const userLookupInflight = new Map<string, Promise<SyncedUser | null>>();

function rememberUser(clerkId: string, user: SyncedUser) {
  userLookupCache.set(clerkId, {
    user,
    expires: Date.now() + USER_LOOKUP_TTL_MS,
  });
}

async function lookupExistingUser(clerkId: string): Promise<SyncedUser | null> {
  const hit = userLookupCache.get(clerkId);
  if (hit && hit.expires > Date.now()) return hit.user;

  const pending = userLookupInflight.get(clerkId);
  if (pending) return pending;

  const promise = (async () => {
    const existing = await db.query.users.findFirst({
      where: eq(users.clerkId, clerkId),
    });
    if (existing) rememberUser(clerkId, existing);
    return existing ?? null;
  })().finally(() => {
    userLookupInflight.delete(clerkId);
  });

  userLookupInflight.set(clerkId, promise);
  return promise;
}

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
  referralCode?: string | null;
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
    Boolean(options?.countryCode) ||
    Boolean(options?.referralCode);

  if (!needsFullSync) {
    try {
      const existing = await lookupExistingUser(clerkUser.id);
      if (existing) {
        const locked = countryOverrideForUser({
          username: existing.username,
          email: existing.email,
        });
        if (locked && existing.countryCode !== locked) {
          const [updated] = await db
            .update(users)
            .set({
              countryCode: locked,
              language: resolveLanguageForCountry(existing.language, locked),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id))
            .returning();
          if (updated) {
            rememberUser(clerkUser.id, updated);
            const { currencyForCountry } = await import("@/lib/country");
            await ensurePrimaryWallet(
              updated.id,
              currencyForCountry(updated.countryCode),
            ).catch(() => undefined);
            return { user: updated, debug };
          }
        }
        return { user: existing, debug };
      }
    } catch (error) {
      console.error("[ensureAppUser-lookup]", error);
    }
  }

  const synced = await syncClerkUserToDb(mapClerkSdkUser(clerkUser), {
    touchLogin: options?.touchLogin,
    countryCode: options?.countryCode,
    forceCountry: options?.forceCountry,
    referralCode: options?.referralCode,
  });
  if (synced) rememberUser(clerkUser.id, synced);
  return { user: synced, debug };
}

const ensureAppUserOnce = cache(async () => {
  const { user } = await resolveAndSync();
  return user;
});

function needsSpecialSync(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  referralCode?: string | null;
  request?: Request;
}) {
  return Boolean(
    options?.touchLogin ||
      options?.countryCode ||
      options?.forceCountry ||
      options?.referralCode ||
      options?.request,
  );
}

/** Ensures the signed-in Clerk user exists in Postgres and returns the DB row. */
export async function ensureAppUser(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  referralCode?: string | null;
  request?: Request;
}): Promise<SyncedUser | null> {
  if (!needsSpecialSync(options)) {
    return ensureAppUserOnce();
  }
  const { user } = await resolveAndSync(options);
  return user;
}

/** Same as ensureAppUser, plus Clerk bearer debug for mobile troubleshooting. */
export async function ensureAppUserDetailed(options?: {
  touchLogin?: boolean;
  countryCode?: string | null;
  forceCountry?: boolean;
  referralCode?: string | null;
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
