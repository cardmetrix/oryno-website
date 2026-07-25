import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";

export const runtime = "nodejs";

/** Called after login / OTP / OAuth to upsert the Postgres user row. */
export async function POST() {
  try {
    const user = await ensureAppUser({ touchLogin: true });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.status === "suspended" || user.status === "deleted") {
      return NextResponse.json(
        { error: "Account disabled", code: "account_disabled" },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        status: user.status,
        kycStatus: user.kycStatus,
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
