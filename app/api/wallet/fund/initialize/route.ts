import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { initiateLocalWalletFund } from "@/lib/paystack/local-fund";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      amount?: string | number;
      callbackUrl?: string;
    };

    const origin = new URL(req.url).origin;
    const callbackUrl =
      body.callbackUrl?.trim() || `${origin}/fund?local_fund=1`;

    const result = await initiateLocalWalletFund({
      userId: user.id,
      email: user.email,
      countryCode: user.countryCode,
      localAmount: body.amount ?? 0,
      callbackUrl,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[wallet-fund-init]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start Paystack checkout",
      },
      { status: 400 },
    );
  }
}
