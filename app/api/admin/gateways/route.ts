import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withAdminApi, titleCaseStatus } from "@/lib/admin/api";
import { db } from "@/lib/db";
import { countryGateways, paymentGateways } from "@/lib/db/schema";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
} from "@/lib/paystack/client";

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

      if (g.slug === "paystack") {
        status = hasPaystackKeys() ? "Connected" : "Available";
        mode = isPaystackDemoMode() ? "Test" : "Live";
      }

      return {
        id: g.id,
        name: g.name,
        countries: countries.length ? countries.join(", ") : "—",
        status,
        mode,
      };
    });

    // Ensure Paystack appears even if gateways table is empty
    if (!fromDb.some((g) => g.name.toLowerCase().includes("paystack"))) {
      fromDb.unshift({
        id: "paystack-runtime",
        name: "Paystack",
        countries: "NG",
        status: hasPaystackKeys() ? "Connected" : "Available",
        mode: isPaystackDemoMode() ? "Test" : "Live",
      });
    }

    return NextResponse.json({ ok: true, gateways: fromDb });
  });
}
