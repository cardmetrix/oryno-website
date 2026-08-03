import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getCountryInfo, resolveCountryCode } from "@/lib/country";
import { detectCountryWithGoogle } from "@/lib/geo/google-country";
import { notifyUserLogin } from "@/lib/notify/auth-events";
import { currencyForCountry, ensurePrimaryWallet } from "@/lib/wallet";

export const runtime = "nodejs";

/** Called after login / OTP / OAuth to upsert the Postgres user + country/wallet. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      countryCode?: string;
      lat?: number;
      lng?: number;
      forceCountry?: boolean;
      announceLogin?: boolean;
    };

    // Geo must never take down sync — fall back to NG if Google fails
    const detected = await detectCountryWithGoogle({
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
    }).catch((geoError) => {
      console.error("[auth-sync-geo]", geoError);
      return {
        countryCode: resolveCountryCode("NG"),
        detectedIso: null,
        source: "fallback" as const,
      };
    });

    const countryCode = body.countryCode
      ? resolveCountryCode(body.countryCode)
      : detected.countryCode;

    // Only overwrite an existing country when Google actually resolved an ISO code
    // (or the client explicitly sent one). Avoid resetting users when geo fails.
    const confident =
      Boolean(body.countryCode) ||
      Boolean(detected.detectedIso) ||
      detected.source === "latlng";

    const user = await ensureAppUser({
      touchLogin: true,
      countryCode,
      forceCountry: body.forceCountry === true && confident,
      request: req,
    });

    if (!user) {
      const authHeader = req.headers.get("authorization");
      console.warn("[auth-sync] unauthorized", {
        hasBearer: Boolean(authHeader?.toLowerCase().startsWith("bearer ")),
        client: req.headers.get("x-oryno-client"),
      });
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "clerk_bearer_rejected",
          hint: "Mobile Bearer JWT was not accepted. Check server logs for [resolveClerkUser].",
        },
        { status: 401 },
      );
    }

    if (user.status === "suspended" || user.status === "deleted") {
      return NextResponse.json(
        { error: "Account disabled", code: "account_disabled" },
        { status: 403 },
      );
    }

    const country = getCountryInfo(user.countryCode ?? countryCode);
    const wallet = await ensurePrimaryWallet(
      user.id,
      currencyForCountry(country.code),
    );

    try {
      const client = await clerkClient();
      await client.users.updateUser(user.clerkId, {
        publicMetadata: {
          countryCode: country.code,
          currency: country.currency,
        },
        unsafeMetadata: {
          countryCode: country.code,
          currency: country.currency,
        },
      });
    } catch (metaError) {
      console.error("[auth-sync-metadata]", metaError);
    }

    if (body.announceLogin === true) {
      try {
        await notifyUserLogin(user);
      } catch (loginNotifyError) {
        console.error("[auth-sync-login-notify]", loginNotifyError);
      }
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        countryCode: country.code,
        status: user.status,
        kycStatus: user.kycStatus,
      },
      country,
      wallet: {
        id: wallet.id,
        currency: wallet.currency,
        balance: wallet.balance,
      },
    });
  } catch (error) {
    console.error("[auth-sync]", error);
    return NextResponse.json(
      { error: "Failed to sync user" },
      { status: 500 },
    );
  }
}
