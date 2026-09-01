import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { countryGateways, paymentGateways } from "@/lib/db/schema";
import {
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";

export const runtime = "nodejs";

export async function GET() {
  return withAdminApi(async () => {
    const rows = await db.select().from(paymentGateways).orderBy(paymentGateways.name);

    const links = await db
      .select({
        gatewayId: countryGateways.gatewayId,
        countryCode: countryGateways.countryCode,
      })
      .from(countryGateways);

    const countriesByGateway = new Map<string, string[]>();
    for (const link of links) {
      const list = countriesByGateway.get(link.gatewayId) || [];
      list.push(link.countryCode);
      countriesByGateway.set(link.gatewayId, list);
    }

    const fromDb = rows.map((g) => {
      const countries = countriesByGateway.get(g.id) || [];
      let status = titleCaseStatus(g.status);
      let mode = titleCaseStatus(g.mode);

      if (g.slug === "flutterwave" || g.slug === "paystack") {
        status = hasFlutterwaveKeys() ? "Connected" : "Available";
        mode = isFlutterwaveDemoMode() ? "Test" : "Live";
      }

      return {
        id: g.id,
        name: g.name,
        countries: countries.length ? countries.join(", ") : "—",
        status,
        mode,
      };
    });

    if (
      !fromDb.some((g) =>
        /flutterwave|paystack/i.test(g.name),
      )
    ) {
      fromDb.unshift({
        id: "flutterwave-runtime",
        name: "Flutterwave",
        countries: "NG, GH, KE, ZA",
        status: hasFlutterwaveKeys() ? "Connected" : "Available",
        mode: isFlutterwaveDemoMode() ? "Test" : "Live",
      });
    }

    return NextResponse.json({ ok: true, gateways: fromDb });
  });
}
