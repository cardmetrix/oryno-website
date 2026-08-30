import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  GHANA_BILL_PRESETS,
  isHubtelDemoMode,
  listHubtelBillServices,
} from "@/lib/hubtel";
import { isSogoDemoMode, listSogoBillServices } from "@/lib/sogo";
import type { VtpassServiceCategory } from "@/lib/vtpass";

export const runtime = "nodejs";

const ALLOWED = [
  "airtime",
  "data",
  "tv-subscription",
  "electricity-bill",
  "water-bill",
] as const;

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const identifier = (searchParams.get("identifier") ||
      "airtime") as VtpassServiceCategory | "water-bill";

    if (!(ALLOWED as readonly string[]).includes(identifier)) {
      return NextResponse.json(
        { error: "Invalid service category" },
        { status: 400 },
      );
    }

    if (
      (user.countryCode || "NG") === "GH" &&
      (identifier === "tv-subscription" ||
        identifier === "electricity-bill" ||
        identifier === "water-bill")
    ) {
      const services = listHubtelBillServices(identifier);
      return NextResponse.json({
        ok: true,
        demo: isHubtelDemoMode(),
        provider: "hubtel",
        countryCode: "GH",
        currency: "GHS",
        presets: GHANA_BILL_PRESETS,
        identifier,
        services: services.map((s) => ({
          serviceID: s.serviceID,
          name: s.name,
          image: s.image,
          customerLabel: s.customerLabel,
          minAmount: s.minAmount,
          maxAmount: s.maxAmount,
        })),
      });
    }

    if (
      (user.countryCode || "NG") === "KE" &&
      (identifier === "tv-subscription" ||
        identifier === "electricity-bill" ||
        identifier === "water-bill")
    ) {
      const {
        KENYA_BILL_PRESETS,
        isKenyaBillsDemoMode,
        listKenyaBillServices,
      } = await import("@/lib/reloadly/utilities");
      const services = listKenyaBillServices(identifier);
      return NextResponse.json({
        ok: true,
        demo: isKenyaBillsDemoMode(),
        provider: "reloadly-utilities",
        countryCode: "KE",
        currency: "KES",
        presets: KENYA_BILL_PRESETS,
        identifier,
        services: services.map((s) => ({
          serviceID: s.serviceID,
          name: s.name,
          image: s.image,
          domain: s.domain,
          customerLabel: s.customerLabel,
          minAmount: s.minAmount,
          maxAmount: s.maxAmount,
        })),
      });
    }

    if (identifier === "water-bill") {
      return NextResponse.json({
        ok: true,
        demo: false,
        provider: "sogo",
        identifier,
        services: [],
      });
    }

    const services = await listSogoBillServices(
      identifier as VtpassServiceCategory,
    );

    return NextResponse.json({
      ok: true,
      demo: isSogoDemoMode(),
      provider: "sogo",
      identifier,
      services: services.map((s) => ({
        serviceID: s.slug,
        name: s.name,
        image: s.image ?? null,
      })),
    });
  } catch (error) {
    console.error("[sogo-bills-services]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load services",
      },
      { status: 400 },
    );
  }
}
