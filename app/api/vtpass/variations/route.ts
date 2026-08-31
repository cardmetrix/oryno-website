import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";
import { isSogoDemoMode, listSogoVariations } from "@/lib/sogo";
import { getDisplayFx } from "@/lib/display-currency";
import { convertLocalToNgn } from "@/lib/fx/rates";
import {
  fallbackVariationsFor,
  getVtpassVariations,
  isIntlDataProductType,
  isKeDataOperator,
  isVtpassDemoMode,
  isZaAirtimeOperator,
  isZaDataOperator,
  keDataPlansFor,
  zaAirtimePacksFor,
  zaDataPlansFor,
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
      | "water-bill"
      | null;

    if ((user.countryCode || "NG") === "ZA") {
      const {
        findZaBillService,
        listZaVariations,
        listZaReloadlyBillers,
        isZaBillsDemoMode,
      } = await import("@/lib/reloadly/utilities");
      const service = findZaBillService(serviceID);
      if (service) {
        const billers = await listZaReloadlyBillers(service.category);
        const live = listZaVariations(serviceID, billers);
        return NextResponse.json({
          ok: true,
          demo: isZaBillsDemoMode(),
          provider: "reloadly-utilities",
          countryCode: "ZA",
          currency: "ZAR",
          serviceID,
          serviceName: live.serviceName,
          variations: live.variations.map((v) => ({
            variationCode: v.variationCode,
            name: v.name,
            amount: v.amount,
            listAmount: v.amount,
            priceOverride: false,
            fixedPrice: v.fixedPrice,
          })),
        });
      }
    }

    if ((user.countryCode || "NG") === "KE") {
      const {
        findKenyaBillService,
        listKenyaVariations,
        listKenyaReloadlyBillers,
        isKenyaBillsDemoMode,
      } = await import("@/lib/reloadly/utilities");
      const service = findKenyaBillService(serviceID);
      if (service) {
        const billers = await listKenyaReloadlyBillers(service.category);
        const live = listKenyaVariations(serviceID, billers);
        return NextResponse.json({
          ok: true,
          demo: isKenyaBillsDemoMode(),
          provider: "reloadly-utilities",
          countryCode: "KE",
          currency: "KES",
          serviceID,
          serviceName: live.serviceName,
          variations: live.variations.map((v) => ({
            variationCode: v.variationCode,
            name: v.name,
            amount: v.amount,
            listAmount: v.amount,
            priceOverride: false,
            fixedPrice: v.fixedPrice,
          })),
        });
      }
    }

    if ((user.countryCode || "NG") === "GH") {
      const {
        findHubtelBillService,
        listHubtelVariations,
        isHubtelDemoMode,
      } = await import("@/lib/hubtel");
      if (findHubtelBillService(serviceID)) {
        const live = listHubtelVariations(serviceID);
        return NextResponse.json({
          ok: true,
          demo: isHubtelDemoMode(),
          provider: "hubtel",
          countryCode: "GH",
          currency: "GHS",
          serviceID,
          serviceName: live.serviceName,
          variations: live.variations.map((v) => ({
            variationCode: v.variationCode,
            name: v.name,
            amount: v.amount,
            listAmount: v.amount,
            priceOverride: false,
            fixedPrice: v.fixedPrice,
          })),
        });
      }
    }

    // International airtime/data still uses VTpass
    if (serviceID === "foreign-airtime" || operatorId || productTypeId) {
      const zaData =
        isZaDataOperator(operatorId) && isIntlDataProductType(productTypeId);
      const keData =
        isKeDataOperator(operatorId) && isIntlDataProductType(productTypeId);
      const zaAirtime =
        isZaAirtimeOperator(operatorId) && !isIntlDataProductType(productTypeId);

      if (keData) {
        const fx = await getDisplayFx("KE");
        const plans = keDataPlansFor(operatorId!);
        const priced = await Promise.all(
          plans.map(async (p) => {
            const base = convertLocalToNgn(p.kes, fx.localToNgn);
            const result = await priceLocalAmount({
              provider: "vtpass",
              serviceKey: `foreign-airtime:${p.variation_code}`,
              amount: base,
            });
            return {
              variationCode: p.variation_code,
              name: p.name,
              amount: result.local,
              listAmount: result.listLocal,
              priceOverride: result.overrideApplied,
              fixedPrice: true,
              variationAmount: String(base),
              chargedAmount: base,
            };
          }),
        );
        return NextResponse.json({
          ok: true,
          demo: isVtpassDemoMode(),
          provider: "vtpass",
          countryCode: "KE",
          currency: "KES",
          serviceID,
          serviceName: operatorId,
          variations: priced,
        });
      }

      if (zaData || zaAirtime) {
        if (!isVtpassDemoMode()) {
          return NextResponse.json(
            {
              error:
                "Live VTpass operators are required for South Africa. Catalog packs are demo-only.",
            },
            { status: 400 },
          );
        }
        const fx = await getDisplayFx("ZA");
        const plans = zaData
          ? zaDataPlansFor(operatorId!)
          : zaAirtimePacksFor(operatorId!);
        const priced = await Promise.all(
          plans.map(async (p) => {
            const base = convertLocalToNgn(p.zar, fx.localToNgn);
            const result = await priceLocalAmount({
              provider: "vtpass",
              serviceKey: `foreign-airtime:${p.variation_code}`,
              amount: base,
            });
            return {
              variationCode: p.variation_code,
              name: p.name,
              amount: result.local,
              listAmount: result.listLocal,
              priceOverride: result.overrideApplied,
              fixedPrice: true,
              variationAmount: String(base),
              chargedAmount: base,
            };
          }),
        );
        return NextResponse.json({
          ok: true,
          demo: true,
          provider: "vtpass",
          countryCode: "ZA",
          currency: "ZAR",
          serviceID,
          serviceName: operatorId,
          variations: priced,
        });
      }

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
          console.error("[vtpass-variations-live]", error);
          variations = [];
        }
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
