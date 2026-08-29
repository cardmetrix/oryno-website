import { NextResponse } from "next/server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { normalizeUsername, isValidUsername } from "@/lib/auth/username";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveCountryCode } from "@/lib/country";
import { toProfileDto } from "@/lib/profile";
import { uploadBase64Image, type ImagePayload } from "@/lib/upload-image";
import { currencyForCountry, ensurePrimaryWallet } from "@/lib/wallet";

export const runtime = "nodejs";

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

    const { getDisplayFx } = await import("@/lib/display-currency");
    const displayFx = await getDisplayFx(dbUser.countryCode);

    return NextResponse.json({
      profile: toProfileDto(dbUser, { clerkImageUrl: clerkUser.imageUrl }),
      displayFx,
    });
  } catch (error) {
    console.error("[profile-get]", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      fullName?: string;
      phone?: string;
      username?: string;
      avatarUrl?: string;
      image?: ImagePayload;
      countryCode?: string;
    };

    const dbUser = await ensureAppUser();
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const fullName = body.fullName?.trim() || dbUser.fullName;
    const phone = body.phone?.trim() || dbUser.phone;
    let username = dbUser.username;

    if (typeof body.username === "string") {
      const next = normalizeUsername(body.username);
      if (!isValidUsername(next)) {
        return NextResponse.json(
          { error: "Username must be 3–32 characters (letters, numbers, _)." },
          { status: 400 },
        );
      }
      username = next;
    }

    let avatarUrl =
      typeof body.avatarUrl === "string" ? body.avatarUrl : dbUser.avatarUrl;

    if (body.image?.base64) {
      const uploaded = await uploadBase64Image(
        body.image,
        `avatar-${dbUser.id}.jpg`,
      );
      if (!uploaded) {
        return NextResponse.json(
          { error: "Profile photo upload failed" },
          { status: 400 },
        );
      }
      avatarUrl = uploaded;
    }
    const countryCode =
      typeof body.countryCode === "string"
        ? resolveCountryCode(body.countryCode)
        : dbUser.countryCode;

    const [nameFirst, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(" ") || undefined;

    const client = await clerkClient();
    await client.users.updateUser(clerkUser.id, {
      firstName: nameFirst || undefined,
      lastName,
      username: username || undefined,
      publicMetadata: {
        ...clerkUser.publicMetadata,
        fullName,
        phone,
        avatarUrl,
        countryCode: countryCode ?? undefined,
      },
      unsafeMetadata: {
        ...clerkUser.unsafeMetadata,
        fullName,
        phone,
        username,
        countryCode: countryCode ?? undefined,
      },
    });

    const primaryEmail =
      clerkUser.primaryEmailAddress?.emailAddress?.toLowerCase().trim() ||
      dbUser.email;
    const emailVerified =
      clerkUser.primaryEmailAddress?.verification?.status === "verified";
    const emailChanged =
      primaryEmail.toLowerCase() !== (dbUser.email || "").toLowerCase();

    if (emailChanged) {
      const taken = await db.query.users.findFirst({
        where: eq(users.email, primaryEmail),
        columns: { id: true },
      });
      if (taken && taken.id !== dbUser.id) {
        return NextResponse.json(
          { error: "That email is already used by another account." },
          { status: 409 },
        );
      }
    }

    let updated;
    try {
      const [row] = await db
        .update(users)
        .set({
          fullName,
          phone,
          username,
          avatarUrl,
          countryCode,
          email: primaryEmail,
          emailVerifiedAt: emailVerified
            ? emailChanged
              ? new Date()
              : (dbUser.emailVerifiedAt ?? new Date())
            : dbUser.emailVerifiedAt,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dbUser.id))
        .returning();
      updated = row;
    } catch (updateError) {
      console.error("[profile-patch-email]", updateError);
      return NextResponse.json(
        { error: "Could not update email. It may already be in use." },
        { status: 409 },
      );
    }

    if (countryCode) {
      await ensurePrimaryWallet(
        dbUser.id,
        currencyForCountry(countryCode),
      );
    }

    return NextResponse.json({
      profile: toProfileDto(updated, {
        clerkImageUrl: clerkUser.imageUrl,
      }),
    });
  } catch (error) {
    console.error("[profile-patch]", error);
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
