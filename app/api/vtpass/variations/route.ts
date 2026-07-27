import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
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

    let variations;
    let serviceName = serviceID;

    if (isVtpassDemoMode() && serviceID !== "foreign-airtime") {
      variations = fallbackVariationsFor(serviceID);
    } else {
      try {
        const live = await getVtpassVariations(serviceID, {
          operator_id: operatorId,
          product_type_id: productTypeId,
        });
        variations = live.variations;
        serviceName = live.serviceName;
      } catch (error) {
        if (serviceID === "foreign-airtime") throw error;
        variations = fallbackVariationsFor(serviceID);
      }
    }

    if (!variations.length) {
      variations = fallbackVariationsFor(serviceID);
    }

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      serviceID,
      serviceName,
      variations: variations.map((v) => ({
        variationCode: v.variation_code,
        name: v.name,
        amount: Number(v.charged_amount ?? v.variation_amount) || 0,
        fixedPrice: String(v.fixedPrice || "").toLowerCase() === "yes",
        variationAmount: v.variation_amount,
        chargedAmount: v.charged_amount,
        variationRate: v.variation_rate,
      })),
    });
  } catch (error) {
    console.error("[vtpass-variations]", error);
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
