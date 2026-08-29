import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { SUPPORTED_COUNTRIES } from "@/lib/country";
import { providerSignupLinks, SERVICE_PROVIDERS } from "@/lib/country-providers";

export const runtime = "nodejs";

/** Signup + API-key links for every ORYNO market. */
export async function GET() {
  const user = await ensureAppUser();
  const countryCode = user?.countryCode || "NG";

  return NextResponse.json({
    ok: true,
    country: providerSignupLinks(countryCode),
    all: Object.keys(SUPPORTED_COUNTRIES).map((code) =>
      providerSignupLinks(code),
    ),
    providers: SERVICE_PROVIDERS.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      countries: p.countries,
      signupUrl: p.signupUrl,
      dashboardUrl: p.dashboardUrl,
      apiKeysUrl: p.apiKeysUrl,
      docsUrl: p.docsUrl,
      credentials: p.credentials,
      notes: p.notes ?? null,
    })),
  });
}
