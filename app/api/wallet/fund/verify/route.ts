import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { verifyLocalWalletFund } from "@/lib/paystack/local-fund";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { reference?: string };
    if (!body.reference?.trim()) {
      return NextResponse.json(
        { error: "Missing payment reference" },
        { status: 400 },
      );
    }

    const result = await verifyLocalWalletFund({
      userId: user.id,
      reference: body.reference.trim(),
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[wallet-fund-verify]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to verify payment",
      },
      { status: 400 },
    );
  }
}
