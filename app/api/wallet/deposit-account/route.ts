import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { getWalletFundOptions } from "@/lib/paystack/deposit-accounts";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = await getWalletFundOptions(user);
    return NextResponse.json(options);
  } catch (error) {
    console.error("[deposit-account-get]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load deposit account",
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    await ensureWalletSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const options = await getWalletFundOptions(user);
    return NextResponse.json({
      ok: true,
      ...options,
    });
  } catch (error) {
    console.error("[deposit-account-post]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create deposit account",
      },
      { status: 500 },
    );
  }
}
