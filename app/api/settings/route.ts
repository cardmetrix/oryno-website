import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  isLanguageAllowedForCountry,
  resolveLanguageForCountry,
} from "@/lib/country";
import { db } from "@/lib/db";
import { userSecurity, users } from "@/lib/db/schema";
import { toProfileDto } from "@/lib/profile";

export const runtime = "nodejs";

async function getOrCreateSecurity(userId: string) {
  const existing = await db.query.userSecurity.findFirst({
    where: eq(userSecurity.userId, userId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(userSecurity)
    .values({ userId })
    .returning();
  return created;
}

export async function GET() {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await ensureAppUser();
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const security = await getOrCreateSecurity(dbUser.id);
    const notificationsEnabled =
      typeof clerkUser.publicMetadata?.notificationsEnabled === "boolean"
        ? clerkUser.publicMetadata.notificationsEnabled
        : true;

    return NextResponse.json({
      profile: toProfileDto(dbUser, { clerkImageUrl: clerkUser.imageUrl }),
      preferences: {
        theme: dbUser.theme,
        language: dbUser.language,
        notificationsEnabled,
      },
      security: {
        twoFactorEnabled: security.twoFactorEnabled,
        biometricEnabled: security.biometricEnabled,
        hasPin: Boolean(security.pinHash),
        lockedUntil: security.lockedUntil,
      },
    });
  } catch (error) {
    console.error("[settings-get]", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await ensureAppUser();
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      theme?: "light" | "dark" | "system";
      language?: string;
      notificationsEnabled?: boolean;
      twoFactorEnabled?: boolean;
      biometricEnabled?: boolean;
      pin?: string;
      currentPin?: string;
    };

    const security = await getOrCreateSecurity(dbUser.id);

    if (typeof body.language === "string") {
      const nextLanguage = body.language.trim().toLowerCase();
      if (!isLanguageAllowedForCountry(nextLanguage, dbUser.countryCode)) {
        return NextResponse.json(
          {
            error:
              "That language isn’t available for your current country. English is always available.",
          },
          { status: 400 },
        );
      }
    }

    if (body.theme || body.language) {
      await db
        .update(users)
        .set({
          theme: body.theme ?? dbUser.theme,
          language: body.language
            ? resolveLanguageForCountry(body.language, dbUser.countryCode)
            : dbUser.language,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dbUser.id));
    }

    if (typeof body.notificationsEnabled === "boolean") {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const client = await clerkClient();
      await client.users.updateUser(clerkUser.id, {
        publicMetadata: {
          ...clerkUser.publicMetadata,
          notificationsEnabled: body.notificationsEnabled,
        },
      });
    }

    const securityPatch: Partial<typeof userSecurity.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (typeof body.twoFactorEnabled === "boolean") {
      securityPatch.twoFactorEnabled = body.twoFactorEnabled;
    }
    if (typeof body.biometricEnabled === "boolean") {
      securityPatch.biometricEnabled = body.biometricEnabled;
    }

    if (typeof body.pin === "string") {
      const pin = body.pin.trim();
      if (!/^\d{4,6}$/.test(pin)) {
        return NextResponse.json(
          { error: "PIN must be 4–6 digits." },
          { status: 400 },
        );
      }

      if (security.pinHash) {
        if (!body.currentPin) {
          return NextResponse.json(
            { error: "Current PIN is required to change it." },
            { status: 400 },
          );
        }
        const ok = await bcrypt.compare(body.currentPin, security.pinHash);
        if (!ok) {
          return NextResponse.json(
            { error: "Current PIN is incorrect." },
            { status: 400 },
          );
        }
      }

      securityPatch.pinHash = await bcrypt.hash(pin, 10);
      securityPatch.failedPinAttempts = 0;
      securityPatch.lockedUntil = null;
    }

    if (
      typeof body.twoFactorEnabled === "boolean" ||
      typeof body.biometricEnabled === "boolean" ||
      typeof body.pin === "string"
    ) {
      await db
        .update(userSecurity)
        .set(securityPatch)
        .where(eq(userSecurity.userId, dbUser.id));
    }

    const refreshedUser = await db.query.users.findFirst({
      where: eq(users.id, dbUser.id),
    });
    const refreshedSecurity = await getOrCreateSecurity(dbUser.id);
    const refreshedClerk = await currentUser();

    return NextResponse.json({
      ok: true,
      profile: refreshedUser
        ? toProfileDto(refreshedUser, {
            clerkImageUrl: refreshedClerk?.imageUrl,
          })
        : null,
      preferences: {
        theme: refreshedUser?.theme ?? dbUser.theme,
        language: refreshedUser?.language ?? dbUser.language,
        notificationsEnabled:
          typeof refreshedClerk?.publicMetadata?.notificationsEnabled ===
          "boolean"
            ? refreshedClerk.publicMetadata.notificationsEnabled
            : true,
      },
      security: {
        twoFactorEnabled: refreshedSecurity.twoFactorEnabled,
        biometricEnabled: refreshedSecurity.biometricEnabled,
        hasPin: Boolean(refreshedSecurity.pinHash),
        lockedUntil: refreshedSecurity.lockedUntil,
      },
    });
  } catch (error) {
    console.error("[settings-patch]", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
