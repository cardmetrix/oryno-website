import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  countries,
  referralCodes,
  userSecurity,
  users,
  wallets,
} from "@/lib/db/schema";

export type SyncedUser = typeof users.$inferSelect;

export type ClerkUserLike = {
  id: string;
  username?: string | null;
  imageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  emailAddresses?: Array<{
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
  primaryPhoneNumber?: { phoneNumber: string } | null;
  phoneNumbers?: Array<{
    phoneNumber: string;
    verification?: { status?: string | null } | null;
  }>;
  unsafeMetadata?: Record<string, unknown> | null;
  publicMetadata?: Record<string, unknown> | null;
};

const DEFAULT_COUNTRIES = [
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    currencySymbol: "₦",
    flagEmoji: "🇳🇬",
    status: "live" as const,
  },
  {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    currencySymbol: "GH₵",
    flagEmoji: "🇬🇭",
    status: "beta" as const,
  },
  {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    currencySymbol: "KSh",
    flagEmoji: "🇰🇪",
    status: "beta" as const,
  },
  {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    currencySymbol: "R",
    flagEmoji: "🇿🇦",
    status: "beta" as const,
  },
];

function countryFromPhone(phone?: string | null): string {
  if (!phone) return "NG";
  const normalized = phone.replace(/\s+/g, "");
  if (normalized.startsWith("+234") || normalized.startsWith("234")) return "NG";
  if (normalized.startsWith("+233") || normalized.startsWith("233")) return "GH";
  if (normalized.startsWith("+254") || normalized.startsWith("254")) return "KE";
  if (normalized.startsWith("+27") || normalized.startsWith("27")) return "ZA";
  return "NG";
}

function pickFullName(clerkUser: ClerkUserLike): string {
  const metaName =
    typeof clerkUser.unsafeMetadata?.fullName === "string"
      ? clerkUser.unsafeMetadata.fullName
      : typeof clerkUser.publicMetadata?.fullName === "string"
        ? clerkUser.publicMetadata.fullName
        : null;

  if (metaName?.trim()) return metaName.trim();
  if (clerkUser.fullName?.trim()) return clerkUser.fullName.trim();

  const joined = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return joined || "ORYNO User";
}

function pickEmail(clerkUser: ClerkUserLike): string {
  return (
    clerkUser.primaryEmailAddress?.emailAddress ||
    clerkUser.emailAddresses?.[0]?.emailAddress ||
    ""
  );
}

function pickUsername(clerkUser: ClerkUserLike): string | null {
  const meta =
    typeof clerkUser.unsafeMetadata?.username === "string"
      ? clerkUser.unsafeMetadata.username
      : typeof clerkUser.publicMetadata?.username === "string"
        ? clerkUser.publicMetadata.username
        : null;
  const value = (clerkUser.username || meta || "").trim().toLowerCase();
  return value || null;
}

function pickAvatarUrl(clerkUser: ClerkUserLike): string | null {
  const meta =
    typeof clerkUser.publicMetadata?.avatarUrl === "string"
      ? clerkUser.publicMetadata.avatarUrl
      : typeof clerkUser.unsafeMetadata?.avatarUrl === "string"
        ? clerkUser.unsafeMetadata.avatarUrl
        : null;
  return meta || clerkUser.imageUrl || null;
}

function pickPhone(clerkUser: ClerkUserLike): string | null {
  const metaPhone =
    typeof clerkUser.unsafeMetadata?.phone === "string"
      ? clerkUser.unsafeMetadata.phone
      : typeof clerkUser.publicMetadata?.phone === "string"
        ? clerkUser.publicMetadata.phone
        : null;

  return (
    clerkUser.primaryPhoneNumber?.phoneNumber ||
    clerkUser.phoneNumbers?.[0]?.phoneNumber ||
    metaPhone ||
    null
  );
}

function isEmailVerified(clerkUser: ClerkUserLike): boolean {
  const primary = clerkUser.primaryEmailAddress?.emailAddress;
  const match = clerkUser.emailAddresses?.find(
    (e) => e.emailAddress === primary,
  );
  return (
    match?.verification?.status === "verified" ||
    clerkUser.emailAddresses?.some((e) => e.verification?.status === "verified") ===
      true
  );
}

async function ensureDefaultCountries() {
  for (const country of DEFAULT_COUNTRIES) {
    await db.insert(countries).values(country).onConflictDoNothing();
  }
}

function referralFromName(fullName: string) {
  const stem = fullName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORY${stem || "USER"}${suffix}`;
}

type ClerkSdkUser = {
  id: string;
  username: string | null;
  imageUrl: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  primaryEmailAddress: { emailAddress: string } | null;
  emailAddresses: Array<{
    emailAddress: string;
    verification?: { status?: string | null } | null;
  }>;
  primaryPhoneNumber: { phoneNumber: string } | null;
  phoneNumbers: Array<{
    phoneNumber: string;
    verification?: { status?: string | null } | null;
  }>;
  unsafeMetadata: Record<string, unknown>;
  publicMetadata: Record<string, unknown>;
};

export function mapClerkSdkUser(user: ClerkSdkUser): ClerkUserLike {
  return {
    id: user.id,
    username: user.username,
    imageUrl: user.imageUrl,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: user.fullName,
    primaryEmailAddress: user.primaryEmailAddress
      ? { emailAddress: user.primaryEmailAddress.emailAddress }
      : null,
    emailAddresses: user.emailAddresses.map((e) => ({
      emailAddress: e.emailAddress,
      verification: { status: e.verification?.status },
    })),
    primaryPhoneNumber: user.primaryPhoneNumber
      ? { phoneNumber: user.primaryPhoneNumber.phoneNumber }
      : null,
    phoneNumbers: user.phoneNumbers.map((p) => ({
      phoneNumber: p.phoneNumber,
      verification: { status: p.verification?.status },
    })),
    unsafeMetadata: user.unsafeMetadata,
    publicMetadata: user.publicMetadata,
  };
}

export async function syncClerkUserToDb(
  clerkUser: ClerkUserLike,
  options?: { touchLogin?: boolean },
): Promise<SyncedUser> {
  const email = pickEmail(clerkUser).toLowerCase().trim();
  if (!email) {
    throw new Error("Clerk user is missing an email address");
  }

  const fullName = pickFullName(clerkUser);
  const username = pickUsername(clerkUser);
  const phone = pickPhone(clerkUser);
  const avatarUrl = pickAvatarUrl(clerkUser);
  const countryCode = countryFromPhone(phone);
  const emailVerifiedAt = isEmailVerified(clerkUser) ? new Date() : null;

  await ensureDefaultCountries();

  const existingByClerk = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  });

  const existingByEmail = existingByClerk
    ? null
    : await db.query.users.findFirst({
        where: eq(users.email, email),
      });

  const existing = existingByClerk ?? existingByEmail;
  const now = new Date();

  let dbUser: SyncedUser;

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        clerkId: clerkUser.id,
        username: username ?? existing.username,
        fullName,
        email,
        phone,
        avatarUrl: existing.avatarUrl ?? avatarUrl,
        countryCode: existing.countryCode ?? countryCode,
        emailVerifiedAt: existing.emailVerifiedAt ?? emailVerifiedAt,
        lastLoginAt: options?.touchLogin ? now : existing.lastLoginAt,
        updatedAt: now,
        status: existing.status === "deleted" ? "active" : existing.status,
      })
      .where(eq(users.id, existing.id))
      .returning();
    dbUser = updated;
  } else {
    const [created] = await db
      .insert(users)
      .values({
        clerkId: clerkUser.id,
        username,
        fullName,
        email,
        phone,
        avatarUrl,
        countryCode,
        emailVerifiedAt,
        lastLoginAt: options?.touchLogin ? now : null,
      })
      .returning();
    dbUser = created;
  }

  await db
    .insert(userSecurity)
    .values({ userId: dbUser.id })
    .onConflictDoNothing();

  const currency =
    DEFAULT_COUNTRIES.find((c) => c.code === (dbUser.countryCode ?? "NG"))
      ?.currency ?? "NGN";

  await db
    .insert(wallets)
    .values({
      userId: dbUser.id,
      currency,
      balance: "0",
      isPrimary: true,
    })
    .onConflictDoNothing();

  const hasReferral = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.userId, dbUser.id),
  });

  if (!hasReferral) {
    await db.insert(referralCodes).values({
      userId: dbUser.id,
      code: referralFromName(fullName),
    });
  }

  return dbUser;
}

export async function softDeleteClerkUser(clerkId: string) {
  await db
    .update(users)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId));
}
