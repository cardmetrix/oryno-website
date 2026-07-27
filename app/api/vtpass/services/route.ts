import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  cleanNetworkName,
  fallbackServicesFor,
  getVtpassServices,
  isVtpassDemoMode,
  resolveServiceImage,
  type VtpassServiceCategory,
} from "@/lib/vtpass";

export const runtime = "nodejs";

const ALLOWED: VtpassServiceCategory[] = [
  "airtime",
  "data",
  "tv-subscription",
  "electricity-bill",
];

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const identifier = (searchParams.get("identifier") ||
      "airtime") as VtpassServiceCategory;

    if (!ALLOWED.includes(identifier)) {
      return NextResponse.json(
        { error: "Invalid service category" },
        { status: 400 },
      );
    }

    let services = isVtpassDemoMode()
      ? fallbackServicesFor(identifier)
      : await getVtpassServices(identifier);

    if (!services.length) {
      services = fallbackServicesFor(identifier);
    }

    // Local airtime/data lists should not include foreign-airtime product
    const filtered = services.filter(
      (s) => s.serviceID !== "foreign-airtime",
    );

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      identifier,
      services: filtered.map((s) => ({
        serviceID: s.serviceID,
        name: cleanNetworkName(s.name),
        rawName: s.name,
        minAmount: Number(s.minimium_amount) || undefined,
        maxAmount: Number(s.maximum_amount) || undefined,
        convenienceFee: s.convinience_fee,
        image: resolveServiceImage(s.image, s.serviceID),
      })),
    });
  } catch (error) {
    console.error("[vtpass-services]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load services",
      },
      { status: 400 },
    );
  }
}
