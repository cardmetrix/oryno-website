import { NextResponse } from "next/server";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  getCountryInfo,
  resolveCountryCode,
  resolveLanguageForCountry,
} from "@/lib/country";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { currencyForCountry, ensurePrimaryWallet } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const country = getCountryInfo(user.countryCode);
    const wallet = await ensurePrimaryWallet(
      user.id,
      currencyForCountry(country.code),
    );

    return NextResponse.json({
      country,
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

    const country = getCountryInfo(resolveCountryCode(body.countryCode));

    const [updated] = await db
      .update(users)
      .set({
        countryCode: country.code,
        language: resolveLanguageForCountry(user.language, country.code),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    const wallet = await ensurePrimaryWallet(
      user.id,
      currencyForCountry(country.code),
    );

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
