import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { priceLocalAmount, createLocalPricer } from "@/lib/pricing/service-pricing";
import { getDisplayFx } from "@/lib/display-currency";
import { convertLocalToNgn } from "@/lib/fx/rates";
import {
  isNigeriaMarket,
  isPairgateSandbox,
  listCableVariations,
  listDataVariations,
  listElectricityServices,
  listElectricityVariations,
  listTvServices,
  normalizePairgateDisco,
  normalizePairgateNetwork,
  normalizePairgateTv,
  requirePairgateForNigeria,
  warmDataPlanCatalog,
} from "@/lib/pairgate";
import {
  fallbackVariationsFor,
  getVtpassVariations,
  isIntlDataProductType,
  isKeDataOperator,
  isVtpassDemoMode,
  isZaAirtimeOperator,
  isZaDataOperator,
  keDataPlansFor,
  resolveKeDataOperatorId,
  zaAirtimePacksFor,
  zaDataPlansFor,
} from "@/lib/vtpass";

export const runtime = "nodejs";
export const maxDuration = 60;

async function keDataCatalogResponse(serviceID: string, operatorId: string) {
  const fx = await getDisplayFx("KE");
  const plans = keDataPlansFor(operatorId);
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

function isPairgateBillService(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  if (listTvServices().some((s) => s.serviceID === normalizePairgateTv(key))) {
    return "tv" as const;
  }
  if (
    listElectricityServices().some(
      (s) => s.serviceID === normalizePairgateDisco(key),
    )
  ) {
    return "electricity" as const;
  }
  // Legacy VTpass IDs that map to Pairgate
  if (normalizePairgateTv(key) !== key && /dstv|gotv|startimes/.test(key)) {
    return "tv" as const;
  }
  if (
    normalizePairgateDisco(key) !== key ||
    /electric|ikedc|eko|aedc|kedco|ibedc|jedc|kaduna|enugu|benin|aba|yola|^ph$/.test(
      key,
    )
  ) {
    return "electricity" as const;
  }
  return null;
}

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
    const country = (user.countryCode || "NG").toUpperCase();

    if (
      isNigeriaMarket(country) &&
      !operatorId &&
      !productTypeId &&
      serviceID !== "foreign-airtime"
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
      const networkSlug = normalizePairgateNetwork(serviceID);
      const isDataNetwork = ["mtn", "airtel", "glo", "9mobile"].includes(
        networkSlug,
      );
      const billKind = isPairgateBillService(serviceID);

      if (billKind === "tv") {
        const live = await listCableVariations(serviceID);
        const priced = await Promise.all(
          live.variations.map(async (v) => {
            const base = Number(v.charged_amount) || 0;
            const result = await priceLocalAmount({
              provider: "vtpass",
              serviceKey: `${normalizePairgateTv(serviceID)}:${v.variation_code}`,
              amount: base > 0 ? base : 1000,
            });
            return {
              variationCode: v.variation_code,
              name: v.name,
              amount: base > 0 ? result.local : 0,
              listAmount: base > 0 ? result.listLocal : 0,
              priceOverride: result.overrideApplied,
              fixedPrice: true,
              variationAmount: v.variation_amount,
              chargedAmount: v.charged_amount,
            };
          }),
        );
        return NextResponse.json({
          ok: true,
          demo: isPairgateSandbox(),
          provider: "pairgate",
          countryCode: "NG",
          currency: "NGN",
          serviceID,
          serviceName: live.serviceName,
          variations: priced,
        });
      }

      if (billKind === "electricity") {
        const live = listElectricityVariations();
        return NextResponse.json({
          ok: true,
          demo: isPairgateSandbox(),
          provider: "pairgate",
          countryCode: "NG",
          currency: "NGN",
          serviceID,
          serviceName: live.serviceName,
          variations: live.variations.map((v) => ({
            variationCode: v.variation_code,
            name: v.name,
            amount: 0,
            listAmount: 0,
            priceOverride: false,
            fixedPrice: false,
            variationAmount: v.variation_amount,
            chargedAmount: 0,
          })),
        });
      }

      // Data plans (airtime has no variations)
      if (isDataNetwork || /-data$/i.test(serviceID)) {
        const live = await listDataVariations(serviceID);
        // Prefetch sibling networks so switching MTN→Airtel is instant.
        warmDataPlanCatalog(networkSlug);
        const price = await createLocalPricer("vtpass");
        const priced = live.variations.map((v) => {
          const base = Number(v.charged_amount) || 0;
          const result = price({
            serviceKey: `${networkSlug}:${v.variation_code}`,
            amount: base > 0 ? base : 1000,
          });
          return {
            variationCode: v.variation_code,
            name: v.name,
            amount: base > 0 ? result.local : 0,
            listAmount: base > 0 ? result.listLocal : 0,
            priceOverride: result.overrideApplied,
            fixedPrice: true,
            variationAmount: v.variation_amount,
            chargedAmount: v.charged_amount,
          };
        });
        return NextResponse.json(
          {
            ok: true,
            demo: isPairgateSandbox(),
            provider: "pairgate",
            countryCode: "NG",
            currency: "NGN",
            serviceID,
            serviceName: live.serviceName,
            variations: priced,
          },
          {
            headers: {
              // Browser/client can reuse plans while server SWR refreshes Pairgate.
              "Cache-Control":
                "private, max-age=120, stale-while-revalidate=1800",
            },
          },
        );
      }

      // Never fall through to VTpass for Nigeria
      return NextResponse.json({
        ok: true,
        demo: isPairgateSandbox(),
        provider: "pairgate",
        countryCode: "NG",
        currency: "NGN",
        serviceID,
        serviceName: serviceID,
        variations: [],
      });
    }

    if (country === "ZA") {
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
      const userCountry = (user.countryCode || "NG").toUpperCase();
      const zaData =
        isZaDataOperator(operatorId) && isIntlDataProductType(productTypeId);
      const keCatalogId =
        isKeDataOperator(operatorId)
          ? operatorId!
          : userCountry === "KE" && isIntlDataProductType(productTypeId)
            ? resolveKeDataOperatorId({ operatorId })
            : null;
      const zaAirtime =
        isZaAirtimeOperator(operatorId) && !isIntlDataProductType(productTypeId);

      if (keCatalogId && isIntlDataProductType(productTypeId)) {
        return keDataCatalogResponse(serviceID, keCatalogId);
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

      let variations: Awaited<ReturnType<typeof getVtpassVariations>>["variations"] | ReturnType<typeof fallbackVariationsFor> = [];
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

      const onlyFlexible =
        priced.length > 0 &&
        priced.every(
          (v) =>
            !v.fixedPrice || /flexible|enter amount|enter flexible/i.test(v.name),
        );
      if (
        userCountry === "KE" &&
        isIntlDataProductType(productTypeId) &&
        onlyFlexible
      ) {
        const mapped = resolveKeDataOperatorId({
          operatorId,
          operatorName: serviceName,
        });
        if (mapped) {
          return keDataCatalogResponse(serviceID, mapped);
        }
      }

      return NextResponse.json({
        ok: true,
        demo: isVtpassDemoMode(),
        provider: "vtpass",
        serviceID,
        serviceName,
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
        variations = fallbackVariationsFor(serviceID);
      }
    }

    if (!variations.length) {
      variations = fallbackVariationsFor(serviceID);
    }

    const priced = await Promise.all(
      variations.map(async (v) => {
        const base = Number(v.charged_amount ?? v.variation_amount) || 0;
        const key = `${serviceID}:${v.variation_code || v.name}`;
        const result = await priceLocalAmount({
          provider: "vtpass",
          serviceKey: key,
          amount: base > 0 ? base : 1000,
        });
        return {
          variationCode: v.variation_code,
          name: v.name,
          amount: base > 0 ? result.local : 0,
          listAmount: base > 0 ? result.listLocal : 0,
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
