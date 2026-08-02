import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import {
  countries,
  countryGateways,
  paymentGateways,
} from "@/lib/db/schema";

export const runtime = "nodejs";

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

    return NextResponse.json({
      ok: true,
      countries: rows.map((c) => ({
        code: c.code,
        name: c.name,
        currency: c.currency,
        services: (c.enabledServices || []).join(", ") || "—",
        gateway: gatewayByCountry.get(c.code) || "Paystack",
        status: titleCaseStatus(c.status),
        giftCardsEnabled: c.giftCardsEnabled,
      })),
    });
  });
}
