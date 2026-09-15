import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  fivesimErrorToEnglish,
  isFivesimLive,
  listFivesimOffers,
} from "@/lib/fivesim";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isFivesimLive()) {
      return NextResponse.json(
        {
          error:
            "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
        },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(req.url);
    const service = searchParams.get("service") || "whatsapp";
    const countryParam = searchParams.get("country");

    const { product, serviceName, offers, quote } = await listFivesimOffers({
      service,
      countryCode: countryParam,
      userCountryCode: user.countryCode,
    });

    return NextResponse.json({
      ok: true,
      demo: false,
      provider: "fivesim",
      service: product,
      serviceName,
      currency: "USD",
      fx: quote,
      offers,
    });
  } catch (error) {
    console.error("[numbers-prices]", error);
    return NextResponse.json(
      {
        error: fivesimErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load prices",
        ),
      },
      { status: 400 },
    );
  }
}
