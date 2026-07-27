import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  isVtpassDemoMode,
  verifyVtpassCustomer,
} from "@/lib/vtpass";

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
    };

    if (!body.billersCode?.trim() || !body.serviceID) {
      return NextResponse.json(
        { error: "billersCode and serviceID are required" },
        { status: 400 },
      );
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
        raw: { code: "000" },
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
      raw: result,
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
