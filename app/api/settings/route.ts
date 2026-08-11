import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  isLanguageAllowedForCountry,
  resolveLanguageForCountry,
} from "@/lib/country";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { userSecurity, users } from "@/lib/db/schema";
import { notifyTransactionPinChanged } from "@/lib/notify/pin-events";
import { toProfileDto } from "@/lib/profile";
import { APP_VERSION } from "@/lib/app-version";
import {
  getTransactionPinStatus,
  setTransactionPin,
  TransactionPinError,
} from "@/lib/security/transaction-pin";

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

async function securityPayload(userId: string) {
  const security = await getOrCreateSecurity(userId);
  const status = await getTransactionPinStatus(userId);
  return {
    twoFactorEnabled: security.twoFactorEnabled,
    biometricEnabled: security.biometricEnabled,
    hasPin: status.hasPin,
    lockedUntil: status.lockedUntil,
    isLocked: status.isLocked,
    failedPinAttempts: status.failedPinAttempts,
  };
}

export async function GET() {
  try {
    await ensureWalletSchema();
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await ensureAppUser();
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

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
      security: await securityPayload(dbUser.id),
      appVersion: APP_VERSION,
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
    await ensureWalletSchema();
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
    let touchedSecurityFlags = false;

    if (typeof body.twoFactorEnabled === "boolean") {
      securityPatch.twoFactorEnabled = body.twoFactorEnabled;
      touchedSecurityFlags = true;
    }
    if (typeof body.biometricEnabled === "boolean") {
      securityPatch.biometricEnabled = body.biometricEnabled;
      touchedSecurityFlags = true;
    }

    if (touchedSecurityFlags) {
      await getOrCreateSecurity(dbUser.id);
      await db
        .update(userSecurity)
        .set(securityPatch)
        .where(eq(userSecurity.userId, dbUser.id));
    }

    if (typeof body.pin === "string") {
      try {
        const result = await setTransactionPin({
          userId: dbUser.id,
          pin: body.pin,
          currentPin: body.currentPin,
        });
        try {
          await notifyTransactionPinChanged({
            userId: dbUser.id,
            fullName: dbUser.fullName,
            created: result.created,
          });
        } catch (notifyError) {
          console.error("[settings-pin-notify]", notifyError);
        }
      } catch (error) {
        if (error instanceof TransactionPinError) {
          return NextResponse.json(
            { error: error.message, code: error.code },
            { status: error.status },
          );
        }
        throw error;
      }
    }

    const refreshedUser = await db.query.users.findFirst({
      where: eq(users.id, dbUser.id),
    });
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
      security: await securityPayload(dbUser.id),
      appVersion: APP_VERSION,
    });
  } catch (error) {
    console.error("[settings-patch]", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 },
    );
  }
}
