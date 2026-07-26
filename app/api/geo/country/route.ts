import { NextResponse } from "next/server";
import { getCountryInfo } from "@/lib/country";
import { detectCountryWithGoogle } from "@/lib/geo/google-country";

export const runtime = "nodejs";

/** Detect visitor country via Google Geolocation + reverse geocode. */
export async function GET() {
  try {
    const detected = await detectCountryWithGoogle();
    const country = getCountryInfo(detected.countryCode);

    return NextResponse.json(
      {
        countryCode: country.code,
        name: country.name,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        flagEmoji: country.flagEmoji,
        detectedIso: detected.detectedIso,
        source: detected.source,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (error) {
    console.error("[geo-country-get]", error);
    const country = getCountryInfo("NG");
    return NextResponse.json({
      countryCode: country.code,
      name: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      flagEmoji: country.flagEmoji,
      detectedIso: null,
      source: "fallback",
    });
  }
}

/** Prefer precise browser coordinates when available. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      lat?: number;
      lng?: number;
    };

    const detected = await detectCountryWithGoogle({
      lat: typeof body.lat === "number" ? body.lat : undefined,
      lng: typeof body.lng === "number" ? body.lng : undefined,
    });
    const country = getCountryInfo(detected.countryCode);

    return NextResponse.json({
      countryCode: country.code,
      name: country.name,
      currency: country.currency,
      currencySymbol: country.currencySymbol,
      flagEmoji: country.flagEmoji,
      detectedIso: detected.detectedIso,
      source: detected.source,
    });
  } catch (error) {
    console.error("[geo-country-post]", error);
    return NextResponse.json(
      { error: "Failed to detect country" },
      { status: 500 },
    );
  }
}
