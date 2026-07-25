import { NextResponse } from "next/server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import { normalizeUsername, isValidUsername } from "@/lib/auth/username";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { toProfileDto } from "@/lib/profile";

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

    return NextResponse.json({
      profile: toProfileDto(dbUser, { clerkImageUrl: clerkUser.imageUrl }),
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

    const avatarUrl =
      typeof body.avatarUrl === "string" ? body.avatarUrl : dbUser.avatarUrl;
    const countryCode =
      typeof body.countryCode === "string"
        ? body.countryCode.toUpperCase().slice(0, 2)
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
      },
      unsafeMetadata: {
        ...clerkUser.unsafeMetadata,
        fullName,
        phone,
        username,
      },
    });

    const [updated] = await db
      .update(users)
      .set({
        fullName,
        phone,
        username,
        avatarUrl,
        countryCode,
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id))
      .returning();

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
