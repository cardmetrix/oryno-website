import { NextResponse } from "next/server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  getCountryInfo,
  resolveCountryCode,
  resolveLanguageForCountry,
} from "@/lib/country";
import { countryOverrideForUser } from "@/lib/country-overrides";
import { getDisplayFx } from "@/lib/display-currency";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ensurePrimaryWallet } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const locked = countryOverrideForUser({
      username: user.username,
      email: user.email,
    });
    const country = getCountryInfo(locked ?? user.countryCode);
    if (locked && user.countryCode !== locked) {
      await db
        .update(users)
        .set({
          countryCode: locked,
          language: resolveLanguageForCountry(user.language, locked),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
    const displayFx = await getDisplayFx(country.code);
    const wallet = await ensurePrimaryWallet(user.id, country.currency);

    return NextResponse.json({
      country,
      displayFx,
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        balance: wallet.balance,
      },
    });
  } catch (error) {
    console.error("[me-country-get]", error);
    return NextResponse.json(
      { error: "Failed to load country" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { countryCode?: string };
    if (!body.countryCode) {
      return NextResponse.json(
        { error: "countryCode is required" },
        { status: 400 },
      );
    }

    const locked = countryOverrideForUser({
      username: user.username,
      email: user.email,
    });
    const country = getCountryInfo(
      locked ?? resolveCountryCode(body.countryCode),
    );

    const [updated] = await db
      .update(users)
      .set({
        countryCode: country.code,
        language: resolveLanguageForCountry(user.language, country.code),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    const displayFx = await getDisplayFx(country.code);
    const wallet = await ensurePrimaryWallet(user.id, country.currency);

    try {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const client = await clerkClient();
        await client.users.updateUser(clerkUser.id, {
          publicMetadata: {
            ...clerkUser.publicMetadata,
            countryCode: country.code,
            currency: country.currency,
          },
          unsafeMetadata: {
            ...clerkUser.unsafeMetadata,
            countryCode: country.code,
            currency: country.currency,
          },
        });
      }
    } catch {
      // non-blocking
    }

    return NextResponse.json({
      ok: true,
      country,
      displayFx,
      profileCountryCode: updated.countryCode,
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        balance: wallet.balance,
      },
    });
  } catch (error) {
    console.error("[me-country-patch]", error);
    return NextResponse.json(
      { error: "Failed to update country" },
      { status: 500 },
    );
  }
}
