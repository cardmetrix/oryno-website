import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  GHANA_BILL_PRESETS,
  isHubtelDemoMode,
  listHubtelBillServices,
} from "@/lib/hubtel";
import {
  isNigeriaMarket,
  listAirtimeServices,
  listDataServices,
  listElectricityServices,
  listTvServices,
  requirePairgateForNigeria,
  isPairgateSandbox,
} from "@/lib/pairgate";
import {
  cleanNetworkName,
  fallbackServicesFor,
  getVtpassServices,
  isVtpassDemoMode,
  resolveServiceImage,
  type VtpassServiceCategory,
} from "@/lib/vtpass";

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

    const country = (user.countryCode || "NG").toUpperCase();

    // Nigeria: Pairgate only (same rail as betting). Never fall back to VTpass.
    if (
      isNigeriaMarket(country) &&
      (identifier === "airtime" ||
        identifier === "data" ||
        identifier === "tv-subscription" ||
        identifier === "electricity-bill")
    ) {
      try {
        requirePairgateForNigeria(country);
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Nigeria services are temporarily unavailable",
          },
          { status: 503 },
        );
      }
      const services =
        identifier === "airtime"
          ? listAirtimeServices()
          : identifier === "data"
            ? listDataServices()
            : identifier === "tv-subscription"
              ? listTvServices()
              : listElectricityServices();
      return NextResponse.json({
        ok: true,
        demo: isPairgateSandbox(),
        provider: "pairgate",
        countryCode: "NG",
        currency: "NGN",
        identifier,
        services: services.map((s) => ({
          serviceID: s.serviceID,
          name: s.name,
          image: s.image,
          minAmount: s.minAmount,
          maxAmount: s.maxAmount,
          customerLabel:
            identifier === "tv-subscription"
              ? "Smartcard / IUC"
              : identifier === "electricity-bill"
                ? "Meter number"
                : undefined,
        })),
      });
    }

    if (
      isNigeriaMarket(country) &&
      identifier === "water-bill"
    ) {
      return NextResponse.json({
        ok: true,
        demo: false,
        provider: "pairgate",
        countryCode: "NG",
        currency: "NGN",
        identifier,
        services: [],
        error: "Water bills are not available in Nigeria yet",
      });
    }

    if (
      country === "GH" &&
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
      country === "ZA" &&
      (identifier === "tv-subscription" ||
        identifier === "electricity-bill" ||
        identifier === "water-bill")
    ) {
      const {
        ZA_BILL_PRESETS,
        isZaBillsDemoMode,
        listZaBillServices,
      } = await import("@/lib/reloadly/utilities");
      const services = listZaBillServices(identifier);
      return NextResponse.json({
        ok: true,
        demo: isZaBillsDemoMode(),
        provider: "reloadly-utilities",
        countryCode: "ZA",
        currency: "ZAR",
        presets: ZA_BILL_PRESETS,
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

    if (
      country === "KE" &&
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
        provider: "vtpass",
        identifier,
        services: [],
      });
    }

    let services = isVtpassDemoMode()
      ? fallbackServicesFor(identifier as VtpassServiceCategory)
      : await getVtpassServices(identifier).catch((error) => {
          console.error("[vtpass-services-live]", error);
          return fallbackServicesFor(identifier as VtpassServiceCategory);
        });

    if (!services.length) {
      services = fallbackServicesFor(identifier as VtpassServiceCategory);
    }

    const filtered = services.filter((s) => s.serviceID !== "foreign-airtime");

    return NextResponse.json({
      ok: true,
      demo: isVtpassDemoMode(),
      provider: "vtpass",
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
