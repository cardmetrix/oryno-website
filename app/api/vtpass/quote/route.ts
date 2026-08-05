import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";

export const runtime = "nodejs";

/**
 * Quote retail wallet charge for an open VTpass amount (airtime / electricity).
 * Face amount is what the network/biller receives; retail includes admin markup.
 */
export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serviceID = searchParams.get("serviceID") || "open";
    const variationCode = searchParams.get("variationCode") || null;
    const face = Number(searchParams.get("amount") || "0");
    if (!Number.isFinite(face) || face <= 0) {
      return NextResponse.json({ error: "Enter a valid amount" }, { status: 400 });
    }

    const serviceKey = variationCode
      ? `${serviceID}:${variationCode}`
      : `${serviceID}:open`;
    const priced = await priceLocalAmount({
      provider: "vtpass",
      serviceKey,
      amount: face,
    });

    return NextResponse.json({
      ok: true,
      serviceID,
      variationCode,
      serviceKey,
      face,
      retail: priced.local,
      listAmount: priced.listLocal,
      markup: priced.markup,
      priceOverride: priced.overrideApplied,
    });
  } catch (error) {
    console.error("[vtpass-quote]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to quote price",
      },
      { status: 400 },
    );
  }
}
