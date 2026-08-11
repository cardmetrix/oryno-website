import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  countries,
  referralCodes,
  userSecurity,
  users,
} from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import {
  countryFromPhone as countryFromPhoneLib,
  currencyForCountry,
  resolveCountryCode,
  resolveLanguageForCountry,
  type SupportedCountryCode,
} from "@/lib/country";

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

function countryFromPhone(phone?: string | null): SupportedCountryCode {
  return countryFromPhoneLib(phone) ?? resolveCountryCode("NG");
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

/** One shared seed promise — parallel ensureAppUser calls were deadlocking on countries inserts. */
let countriesReady: Promise<void> | null = null;

async function ensureDefaultCountries() {
  if (!countriesReady) {
    countriesReady = db
      .insert(countries)
      .values(DEFAULT_COUNTRIES)
      .onConflictDoNothing()
      .then(() => undefined)
      .catch((error) => {
        countriesReady = null;
        // Countries are usually already seeded; never fail auth/sync on this.
        console.error("[ensure-default-countries]", error);
      });
  }
  await countriesReady;
}

export function referralFromName(fullName: string) {
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
  options?: {
    touchLogin?: boolean;
    /** Google / client detected country — preferred for new users & when forceCountry */
    countryCode?: string | null;
    /** Overwrite existing country with detected value */
    forceCountry?: boolean;
    /** Invite / referral code from signup link or form */
    referralCode?: string | null;
  },
): Promise<SyncedUser> {
  const email = pickEmail(clerkUser).toLowerCase().trim();
  if (!email) {
    throw new Error("Clerk user is missing an email address");
  }

  const fullName = pickFullName(clerkUser);
  const username = pickUsername(clerkUser);
  const phone = pickPhone(clerkUser);
  const avatarUrl = pickAvatarUrl(clerkUser);
  const phoneCountry = countryFromPhone(phone);
  const detectedCountry = options?.countryCode
    ? resolveCountryCode(options.countryCode)
    : null;
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
    const nextCountry =
      options?.forceCountry && detectedCountry
        ? detectedCountry
        : resolveCountryCode(
            existing.countryCode ?? detectedCountry ?? phoneCountry,
          );

    const nextLanguage = resolveLanguageForCountry(
      existing.language,
      nextCountry,
    );

    try {
      const [updated] = await db
        .update(users)
        .set({
          clerkId: clerkUser.id,
          username: username ?? existing.username,
          fullName,
          email,
          phone,
          avatarUrl: existing.avatarUrl ?? avatarUrl,
          countryCode: nextCountry,
          language: nextLanguage,
          emailVerifiedAt: existing.emailVerifiedAt ?? emailVerifiedAt,
          lastLoginAt: options?.touchLogin ? now : existing.lastLoginAt,
          updatedAt: now,
          status: existing.status === "deleted" ? "active" : existing.status,
        })
        .where(eq(users.id, existing.id))
        .returning();
      dbUser = updated;
    } catch (updateError) {
      // Username unique collision — retry without overwriting username
      console.error("[sync-user-update]", updateError);
      const [updated] = await db
        .update(users)
        .set({
          clerkId: clerkUser.id,
          fullName,
          email,
          phone,
          avatarUrl: existing.avatarUrl ?? avatarUrl,
          countryCode: nextCountry,
          language: nextLanguage,
          emailVerifiedAt: existing.emailVerifiedAt ?? emailVerifiedAt,
          lastLoginAt: options?.touchLogin ? now : existing.lastLoginAt,
          updatedAt: now,
          status: existing.status === "deleted" ? "active" : existing.status,
        })
        .where(eq(users.id, existing.id))
        .returning();
      if (!updated) throw updateError;
      dbUser = updated;
    }
  } else {
    const countryCode = resolveCountryCode(
      detectedCountry ?? phoneCountry ?? "NG",
    );

    try {
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
    } catch (insertError) {
      // Username taken — create without username
      console.error("[sync-user-insert]", insertError);
      const [created] = await db
        .insert(users)
        .values({
          clerkId: clerkUser.id,
          username: null,
          fullName,
          email,
          phone,
          avatarUrl,
          countryCode,
          emailVerifiedAt,
          lastLoginAt: options?.touchLogin ? now : null,
        })
        .returning();
      if (!created) throw insertError;
      dbUser = created;
    }

    try {
      await createNotification({
        userId: dbUser.id,
        title: "Welcome to ORYNO",
        body: "Your wallet is ready. Fund it to pay for airtime, data, bills, and more.",
        type: "system",
        metadata: { href: "/fund", kind: "welcome" },
        forceEmail: true,
      });
    } catch {
      // non-blocking
    }
  }

  await db
    .insert(userSecurity)
    .values({ userId: dbUser.id })
    .onConflictDoNothing();

  const currency = currencyForCountry(dbUser.countryCode);
  try {
    const { ensurePrimaryWallet } = await import("@/lib/wallet");
    await ensurePrimaryWallet(dbUser.id, currency);
  } catch (walletError) {
    // Parallel dashboard requests can race on wallet promote/create — retry once.
    console.error("[sync-user-wallet]", walletError);
    const { ensurePrimaryWallet } = await import("@/lib/wallet");
    await ensurePrimaryWallet(dbUser.id, currency);
  }

  // Parallel ensureAppUser calls on dashboard load — ignore duplicate user/code
  try {
    await db
      .insert(referralCodes)
      .values({
        userId: dbUser.id,
        code: referralFromName(fullName),
      })
      .onConflictDoNothing({ target: referralCodes.userId });
  } catch (referralError) {
    console.error("[sync-user-referral]", referralError);
  }

  const metaCode =
    typeof clerkUser.unsafeMetadata?.referralCode === "string"
      ? clerkUser.unsafeMetadata.referralCode
      : typeof clerkUser.publicMetadata?.referralCode === "string"
        ? clerkUser.publicMetadata.referralCode
        : null;
  const referralCode = options?.referralCode || metaCode;
  if (referralCode) {
    try {
      const { attachReferral } = await import("@/lib/referrals/service");
      await attachReferral({
        referredUserId: dbUser.id,
        code: referralCode,
      });
    } catch (attachError) {
      console.error("[sync-user-referral-attach]", attachError);
    }
  }

  return dbUser;
}

export async function softDeleteClerkUser(clerkId: string) {
  await db
    .update(users)
    .set({ status: "deleted", updatedAt: new Date() })
    .where(eq(users.clerkId, clerkId));
}
