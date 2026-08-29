import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  isSogoDemoMode,
  sogoErrorToEnglish,
  verifySogoMeter,
  verifySogoSmartcard,
} from "@/lib/sogo";

export const runtime = "nodejs";

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

    if ((user.countryCode || "NG") === "GH") {
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

    const category =
      body.category ||
      (body.type === "prepaid" || body.type === "postpaid"
        ? "electricity"
        : "tv");

    if (isSogoDemoMode()) {
      return NextResponse.json({
        ok: true,
        demo: true,
        customerName: "ORYNO Demo Customer",
        customerAddress: "Lagos, Nigeria",
        meterNumber: body.billersCode,
        currentBouquet:
          category === "tv" ? "DStv Compact" : undefined,
        renewalAmount: undefined,
      });
    }

    if (category === "electricity") {
      const meterType =
        body.type === "postpaid" ? "postpaid" : "prepaid";
      const result = await verifySogoMeter({
        discoSlug: body.serviceID,
        meterNumber: body.billersCode.trim(),
        meterType,
      });
      if (!result.customerName) {
        return NextResponse.json(
          { error: "Invalid customer / meter / smartcard number" },
          { status: 400 },
        );
      }
      return NextResponse.json({
        ok: true,
        demo: false,
        customerName: result.customerName,
        customerAddress: result.customerAddress,
        meterNumber: result.meterNumber,
        currentBouquet: undefined,
        renewalAmount: undefined,
      });
    }

    const result = await verifySogoSmartcard({
      provider: body.serviceID,
      smartcardNumber: body.billersCode.trim(),
    });
    if (!result.customerName) {
      return NextResponse.json(
        { error: "Invalid customer / meter / smartcard number" },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      demo: false,
      customerName: result.customerName,
      customerAddress: undefined,
      meterNumber: body.billersCode,
      currentBouquet: result.currentBouquet,
      renewalAmount: result.renewalAmount,
    });
  } catch (error) {
    console.error("[sogo-verify]", error);
    return NextResponse.json(
      {
        error: sogoErrorToEnglish(
          error instanceof Error ? error.message : "Verification failed",
        ),
      },
      { status: 400 },
    );
  }
}
