import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { ensureVirtualCardsSchema } from "@/lib/db/ensure-schema";
import { initiateVirtualCardPurchase } from "@/lib/virtual-cards";

export const runtime = "nodejs";

/** Start Flutterwave checkout to purchase a USD virtual card. */
export async function POST(req: Request) {
  try {
    await ensureVirtualCardsSchema();
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      callbackUrl?: string;
      label?: string;
    };

    const origin =
      body.callbackUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const callbackUrl = origin.includes("card_purchase=")
      ? origin
      : `${origin.replace(/\/$/, "")}/cards?card_purchase=1`;

    const email =
      user.email ||
      `${user.id.replace(/-/g, "").slice(0, 12)}@oryno.users`;

    const result = await initiateVirtualCardPurchase({
      userId: user.id,
      email,
      name: user.fullName,
      phone: user.phone,
      countryCode: user.countryCode,
      callbackUrl,
      label: body.label,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[virtual-card-purchase]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start card purchase",
      },
      { status: 400 },
    );
  }
}
