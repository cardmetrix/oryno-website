import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  FIVESIM_EMAIL_SERVICES,
  fivesimErrorToEnglish,
  isFivesimLive,
  listFivesimOffers,
} from "@/lib/fivesim";

export const runtime = "nodejs";

function resolveEmailProduct(site: string) {
  const raw = site.trim().toLowerCase();
  if (!raw) return "";
  const host = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  const map: Record<string, string> = {
    google: "google",
    "google.com": "google",
    gmail: "google",
    "gmail.com": "google",
    hotmail: "hotmail",
    "hotmail.com": "hotmail",
    microsoft: "microsoft",
    "microsoft.com": "microsoft",
    outlook: "microsoft",
    "outlook.com": "microsoft",
    yahoo: "yahoo",
    "yahoo.com": "yahoo",
    protonmail: "protonmail",
    "proton.me": "protonmail",
    "protonmail.com": "protonmail",
  };
  if (map[raw] || map[host]) return map[raw] || map[host];
  if (FIVESIM_EMAIL_SERVICES.some((s) => s.code === raw)) return raw;
  return "";
}

/** Country offers for mailbox-signup SMS via 5sim. */
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
            "Email signup numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
          demo: true,
          domains: [],
          offers: [],
        },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(req.url);
    const site = searchParams.get("site") || searchParams.get("service") || "";
    const product = resolveEmailProduct(site);
    if (!product) {
      return NextResponse.json(
        {
          error:
            "Select an email service (google, hotmail, microsoft, yahoo, protonmail)",
        },
        { status: 400 },
      );
    }

    const { serviceName, offers } = await listFivesimOffers({
      service: product,
      userCountryCode: user.countryCode,
    });

    const domains = offers.map((o) => ({
      name: o.countrySlug,
      costUsd: o.priceUsd,
      costLocal: o.priceLocal,
      currency: o.currency,
      count: o.count,
      countryName: o.countryName,
      countrySlug: o.countrySlug,
      iso: o.iso,
      flagUrl: o.flagUrl,
      flagEmoji: o.flagEmoji,
      countryId: o.countryId,
      operator: o.operator,
      service: o.service,
      serviceName: o.serviceName,
    }));

    return NextResponse.json({
      ok: true,
      demo: false,
      provider: "fivesim",
      site: product,
      service: product,
      serviceName,
      domains,
      offers,
    });
  } catch (error) {
    console.error("[email-domains-5sim]", error);
    return NextResponse.json(
      {
        error: fivesimErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load offers",
        ),
      },
      { status: 400 },
    );
  }
}
