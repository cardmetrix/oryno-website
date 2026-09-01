import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi } from "@/lib/admin/api";
import { writeAdminAudit } from "@/lib/admin/auth";
import {
  COUNTRY_PRESETS,
  COUNTRY_STATUS_OPTIONS,
  DEFAULT_COUNTRY_SERVICES,
  countryStatusLabel,
  normalizeCountryCode,
  normalizeCurrency,
  type CountryStatus,
} from "@/lib/admin/countries";
import { db } from "@/lib/db";
import {
  countries,
  countryGateways,
  paymentGateways,
} from "@/lib/db/schema";

export const runtime = "nodejs";

function isStatus(value: string): value is CountryStatus {
  return value === "live" || value === "beta" || value === "disabled";
}

export async function GET() {
  return withAdminApi(async () => {
    const rows = await db.select().from(countries).orderBy(countries.name);

    const links = await db
      .select({
        countryCode: countryGateways.countryCode,
        gatewayName: paymentGateways.name,
        isPrimary: countryGateways.isPrimary,
      })
      .from(countryGateways)
      .innerJoin(
        paymentGateways,
        eq(countryGateways.gatewayId, paymentGateways.id),
      );

    const gatewayByCountry = new Map<string, string>();
    for (const link of links) {
      if (link.isPrimary || !gatewayByCountry.has(link.countryCode)) {
        gatewayByCountry.set(link.countryCode, link.gatewayName);
      }
    }

    const existing = new Set(rows.map((r) => r.code));

    return NextResponse.json({
      ok: true,
      statusOptions: COUNTRY_STATUS_OPTIONS,
      presets: COUNTRY_PRESETS.filter((p) => !existing.has(p.code)),
      countries: rows.map((c) => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        currencySymbol: c.currencySymbol,
        flagEmoji: c.flagEmoji,
        services: c.enabledServices || [],
        servicesLabel: (c.enabledServices || []).join(", ") || "—",
        gateway: gatewayByCountry.get(c.code) || "Flutterwave",
        status: c.status,
        statusLabel: countryStatusLabel(c.status),
        giftCardsEnabled: c.giftCardsEnabled,
      })),
    });
  });
}

export async function POST(req: Request) {
  return withAdminApi(async ({ admin }) => {
    const body = (await req.json().catch(() => ({}))) as {
      code?: string;
      name?: string;
      currency?: string;
      currencySymbol?: string;
      flagEmoji?: string;
      status?: string;
      giftCardsEnabled?: boolean;
      enabledServices?: string[];
    };

    const code = normalizeCountryCode(body.code || "");
    const name = String(body.name || "").trim();
    const currency = normalizeCurrency(body.currency || "");
    const currencySymbol = String(body.currencySymbol || currency || "").trim().slice(0, 8);
    const flagEmoji = String(body.flagEmoji || "").trim().slice(0, 16) || null;
    const status = isStatus(String(body.status || "beta"))
      ? (body.status as CountryStatus)
      : "beta";

    if (!/^[A-Z]{2}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter a valid 2-letter ISO country code (e.g. NG)" },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: "Country name is required" }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json(
        { error: "Enter a valid 3-letter currency code (e.g. NGN)" },
        { status: 400 },
      );
    }

    const existing = await db.query.countries.findFirst({
      where: eq(countries.code, code),
    });
    if (existing) {
      return NextResponse.json(
        { error: `${code} already exists` },
        { status: 409 },
      );
    }

    const services =
      Array.isArray(body.enabledServices) && body.enabledServices.length
        ? body.enabledServices.map((s) => String(s).trim()).filter(Boolean)
        : DEFAULT_COUNTRY_SERVICES;

    const [created] = await db
      .insert(countries)
      .values({
        code,
        name: name.slice(0, 120),
        currency,
        currencySymbol: currencySymbol || currency,
        flagEmoji,
        status,
        giftCardsEnabled: Boolean(body.giftCardsEnabled),
        enabledServices: services,
      })
      .returning();

    await writeAdminAudit({
      adminId: admin.id,
      action: "country.create",
      entityType: "country",
      entityId: code,
      meta: { status, currency },
    });

    return NextResponse.json({
      ok: true,
      country: created
        ? {
            code: created.code,
            name: created.name,
            currency: created.currency,
            currencySymbol: created.currencySymbol,
            flagEmoji: created.flagEmoji,
            status: created.status,
            statusLabel: countryStatusLabel(created.status),
            giftCardsEnabled: created.giftCardsEnabled,
            services: created.enabledServices || [],
          }
        : null,
    });
  });
}
