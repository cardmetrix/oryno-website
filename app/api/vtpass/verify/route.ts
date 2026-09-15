import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  hasPairgateKeys,
  isPairgateSandbox,
  listElectricityServices,
  listTvServices,
  normalizePairgateDisco,
  normalizePairgateTv,
  verifyPairgateCable,
  verifyPairgateElectricity,
} from "@/lib/pairgate";
import { isVtpassDemoMode, verifyVtpassCustomer } from "@/lib/vtpass";

export const runtime = "nodejs";

function isPairgateTv(serviceID: string) {
  const slug = normalizePairgateTv(serviceID);
  return listTvServices().some((s) => s.serviceID === slug);
}

function isPairgateElectricity(serviceID: string) {
  const slug = normalizePairgateDisco(serviceID);
  return listElectricityServices().some((s) => s.serviceID === slug);
}

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      billersCode?: string;
      serviceID?: string;
      type?: string;
      category?: "electricity" | "tv" | "water";
    };

    if (!body.billersCode?.trim() || !body.serviceID) {
      return NextResponse.json(
        { error: "billersCode and serviceID are required" },
        { status: 400 },
      );
    }

    const country = (user.countryCode || "NG").toUpperCase();

    if (country === "NG" && hasPairgateKeys()) {
      const category =
        body.category ||
        (isPairgateTv(body.serviceID)
          ? "tv"
          : isPairgateElectricity(body.serviceID)
            ? "electricity"
            : null);

      if (category === "tv") {
        const result = await verifyPairgateCable({
          serviceID: body.serviceID,
          smartcard: body.billersCode.trim(),
        });
        if (!result.ok) {
          return NextResponse.json(
            { error: result.message || "Could not verify smartcard" },
            { status: 422 },
          );
        }
        return NextResponse.json({
          ok: true,
          demo: isPairgateSandbox(),
          provider: "pairgate",
          customerName: result.customerName,
          meterNumber: body.billersCode,
        });
      }

      if (category === "electricity") {
        const result = await verifyPairgateElectricity({
          serviceID: body.serviceID,
          meterNumber: body.billersCode.trim(),
          meterType: body.type,
        });
        if (!result.ok) {
          return NextResponse.json(
            { error: result.message || "Could not verify meter" },
            { status: 422 },
          );
        }
        return NextResponse.json({
          ok: true,
          demo: isPairgateSandbox(),
          provider: "pairgate",
          customerName: result.customerName,
          meterNumber: body.billersCode,
        });
      }
    }

    if (country === "ZA") {
      const {
        verifyZaBillCustomer,
        isZaBillsDemoMode,
        zaBillErrorToEnglish,
      } = await import("@/lib/reloadly/utilities");
      const result = await verifyZaBillCustomer({
        serviceID: body.serviceID,
        customerRef: body.billersCode.trim(),
        variationCode: body.type,
      });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: zaBillErrorToEnglish(
              result.message || "Could not verify that account",
            ),
          },
          { status: 422 },
        );
      }
      return NextResponse.json({
        ok: true,
        demo: isZaBillsDemoMode(),
        customerName: result.customerName,
        customerAddress: result.customerAddress,
        meterNumber: body.billersCode,
        currentBouquet: result.currentBouquet,
        renewalAmount: result.renewalAmount,
      });
    }

    if (country === "KE") {
      const {
        verifyKenyaBillCustomer,
        isKenyaBillsDemoMode,
        kenyaBillErrorToEnglish,
      } = await import("@/lib/reloadly/utilities");
      const result = await verifyKenyaBillCustomer({
        serviceID: body.serviceID,
        customerRef: body.billersCode.trim(),
        variationCode: body.type,
      });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: kenyaBillErrorToEnglish(
              result.message || "Could not verify that account",
            ),
          },
          { status: 422 },
        );
      }
      return NextResponse.json({
        ok: true,
        demo: isKenyaBillsDemoMode(),
        customerName: result.customerName,
        customerAddress: result.customerAddress,
        meterNumber: body.billersCode,
        currentBouquet: result.currentBouquet,
        renewalAmount: result.renewalAmount,
      });
    }

    if (country === "GH") {
      const { verifyHubtelCustomer, isHubtelDemoMode, hubtelErrorToEnglish } =
        await import("@/lib/hubtel");
      const result = await verifyHubtelCustomer({
        serviceID: body.serviceID,
        customerRef: body.billersCode.trim(),
        variationCode: body.type,
      });
      if (!result.ok) {
        return NextResponse.json(
          {
            error: hubtelErrorToEnglish(
              result.message || "Could not verify that account",
            ),
          },
          { status: 422 },
        );
      }
      return NextResponse.json({
        ok: true,
        demo: isHubtelDemoMode(),
        customerName: result.customerName,
        customerAddress: result.customerAddress,
        meterNumber: body.billersCode,
        currentBouquet: result.currentBouquet,
        renewalAmount: result.renewalAmount,
      });
    }

    if (isVtpassDemoMode()) {
      return NextResponse.json({
        ok: true,
        demo: true,
        customerName: "ORYNO Demo Customer",
        customerAddress: "Lagos, Nigeria",
        meterNumber: body.billersCode,
        currentBouquet: body.serviceID.includes("dstv")
          ? "DStv Compact"
          : undefined,
        renewalAmount: undefined,
      });
    }

    const result = await verifyVtpassCustomer({
      billersCode: body.billersCode.trim(),
      serviceID: body.serviceID,
      type: body.type,
    });

    if (result.WrongBillersCode) {
      return NextResponse.json(
        { error: "Invalid customer / meter / smartcard number" },
        { status: 400 },
      );
    }

    const content = (result.content ?? {}) as Record<string, unknown>;
    const customerName =
      (result.Customer_Name as string | undefined) ||
      (content.Customer_Name as string | undefined) ||
      (content.customer_name as string | undefined);
    const address =
      (result.Address as string | undefined) ||
      (content.Address as string | undefined);
    const meter =
      (result.Meter_Number as string | undefined) ||
      (result.MeterNumber as string | undefined) ||
      (content.Meter_Number as string | undefined);

    return NextResponse.json({
      ok: true,
      demo: false,
      customerName,
      customerAddress: address,
      meterNumber: meter || body.billersCode,
      currentBouquet:
        (result.Current_Bouquet as string | undefined) ||
        (content.Current_Bouquet as string | undefined),
      renewalAmount:
        Number(result.Renewal_Amount ?? content.Renewal_Amount) || undefined,
    });
  } catch (error) {
    console.error("[vtpass-verify]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Verification failed",
      },
      { status: 400 },
    );
  }
}
