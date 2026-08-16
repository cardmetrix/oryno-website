import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";
import { isSogoDemoMode, listSogoVariations } from "@/lib/sogo";
import {
  fallbackVariationsFor,
  getVtpassVariations,
  isVtpassDemoMode,
} from "@/lib/vtpass";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serviceID = searchParams.get("serviceID");
    if (!serviceID) {
      return NextResponse.json(
        { error: "serviceID is required" },
        { status: 400 },
      );
    }

    const operatorId = searchParams.get("operator_id") ?? undefined;
    const productTypeId = searchParams.get("product_type_id") ?? undefined;
    const identifier = searchParams.get("identifier") as
      | "airtime"
      | "data"
      | "tv-subscription"
      | "electricity-bill"
      | null;

    // International airtime/data still uses VTpass
    if (serviceID === "foreign-airtime" || operatorId || productTypeId) {
      let variations;
      let serviceName = serviceID;

      if (isVtpassDemoMode() && serviceID !== "foreign-airtime") {
        variations = fallbackVariationsFor(serviceID);
      } else {
        const live = await getVtpassVariations(serviceID, {
          operator_id: operatorId,
          product_type_id: productTypeId,
        });
        variations = live.variations;
        serviceName = live.serviceName;
      }

      const priced = await Promise.all(
        variations.map(async (v) => {
          const base = Number(v.charged_amount ?? v.variation_amount) || 0;
          const key = `${serviceID}:${v.variation_code || v.name}`;
          const result = await priceLocalAmount({
            provider: "vtpass",
            serviceKey: key,
            amount: base,
          });
          return {
            variationCode: v.variation_code,
            name: v.name,
            amount: result.local,
            listAmount: result.listLocal,
            priceOverride: result.overrideApplied,
            fixedPrice: String(v.fixedPrice || "").toLowerCase() === "yes",
            variationAmount: v.variation_amount,
            chargedAmount: v.charged_amount,
            variationRate: v.variation_rate,
          };
        }),
      );

      return NextResponse.json({
        ok: true,
        demo: isVtpassDemoMode(),
        provider: "vtpass",
        serviceID,
        serviceName,
        variations: priced,
      });
    }

    const live = await listSogoVariations({
      identifier: identifier ?? undefined,
      serviceID,
    });

    const priced = await Promise.all(
      live.variations.map(async (v) => {
        const base = v.amount || 0;
        const key =
          base > 0
            ? `${serviceID}:${v.variationCode}`
            : `${serviceID}:open`;
        const result = await priceLocalAmount({
          provider: "vtpass",
          serviceKey: key,
          amount: base > 0 ? base : 1000,
        });
        return {
          variationCode: v.variationCode,
          name: v.name,
          amount: base > 0 ? result.local : 0,
          listAmount: base > 0 ? result.listLocal : 0,
          priceOverride: result.overrideApplied,
          fixedPrice: v.fixedPrice,
          variationAmount: String(v.amount),
          chargedAmount: v.amount,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      demo: isSogoDemoMode(),
      provider: "sogo",
      serviceID,
      serviceName: live.serviceName,
      variations: priced,
    });
  } catch (error) {
    console.error("[sogo-variations]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load variations",
      },
      { status: 400 },
    );
  }
}
