import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import {
  userVirtualNumbers,
  virtualNumberOffers,
} from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const offers = await db
      .select({
        country: virtualNumberOffers.countryName,
        countryCode: virtualNumberOffers.countryCode,
        buy: virtualNumberOffers.stockBuy,
        rent: virtualNumberOffers.stockRent,
        active: virtualNumberOffers.active,
      })
      .from(virtualNumberOffers)
      .orderBy(virtualNumberOffers.countryName)
      .limit(80);

    const activeByCountry = await db
      .select({
        countryCode: virtualNumberOffers.countryCode,
        country: virtualNumberOffers.countryName,
        activeCount: count(userVirtualNumbers.id),
      })
      .from(userVirtualNumbers)
      .innerJoin(
        virtualNumberOffers,
        eq(userVirtualNumbers.offerId, virtualNumberOffers.id),
      )
      .groupBy(
        virtualNumberOffers.countryCode,
        virtualNumberOffers.countryName,
      );

    const activeMap = new Map(
      activeByCountry.map((r) => [r.countryCode, Number(r.activeCount)]),
    );

    // Prefer offer stock rows; fall back to live rented counts
    const stock =
      offers.length > 0
        ? Object.values(
            offers.reduce<
              Record<
                string,
                { country: string; buy: number; rent: number; active: boolean }
              >
            >((acc, row) => {
              const key = row.countryCode;
              if (!acc[key]) {
                acc[key] = {
                  country: row.country,
                  buy: 0,
                  rent: 0,
                  active: false,
                };
              }
              acc[key].buy += row.buy || 0;
              acc[key].rent += row.rent || 0;
              acc[key].active = acc[key].active || row.active;
              return acc;
            }, {}),
          ).map((row) => {
            const total = row.buy + row.rent;
            let status = "In stock";
            if (total === 0) status = "Buy out";
            else if (total < 40) status = "Low";
            return {
              country: row.country,
              buy: row.buy,
              rent: row.rent,
              status,
            };
          })
        : activeByCountry.map((r) => ({
            country: r.country,
            buy: 0,
            rent: Number(r.activeCount),
            status: Number(r.activeCount) > 0 ? "In stock" : "Buy out",
          }));

    return NextResponse.json({
      ok: true,
      stock,
      rented: Array.from(activeMap.entries()).map(([code, n]) => ({
        countryCode: code,
        count: n,
      })),
      totalRented: await db
        .select({ value: count() })
        .from(userVirtualNumbers)
        .then((r) => Number(r[0]?.value || 0)),
    });
  });
}
