import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  getIntlAirtimeCountries,
  isVtpassDemoMode,
} from "@/lib/vtpass";

export const runtime = "nodejs";

const DEMO_COUNTRIES = [
  {
    code: "GH",
    flag: "https://sandbox.vtpass.com/resources/images/flags/GH.png",
    name: "Ghana",
    currency: "GHS",
    prefix: "233",
  },
  {
    code: "KE",
    flag: "https://sandbox.vtpass.com/resources/images/flags/KE.png",
    name: "Kenya",
    currency: "KES",
    prefix: "254",
  },
  {
    code: "ZA",
    flag: "https://sandbox.vtpass.com/resources/images/flags/ZA.png",
    name: "South Africa",
    currency: "ZAR",
    prefix: "27",
  },
  {
    code: "CM",
    flag: "https://sandbox.vtpass.com/resources/images/flags/CM.png",
    name: "Cameroon",
    currency: "XAF",
    prefix: "237",
  },
  {
    code: "NG",
    flag: "https://sandbox.vtpass.com/resources/images/flags/NG.png",
    name: "Nigeria",
    currency: "NGN",
    prefix: "234",
  },
];

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const countries = isVtpassDemoMode()
      ? DEMO_COUNTRIES
      : await getIntlAirtimeCountries();

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      countries: countries.length ? countries : DEMO_COUNTRIES,
    });
  } catch (error) {
    console.error("[vtpass-intl-countries]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load countries",
      },
      { status: 400 },
    );
  }
}
