import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import { purchaseAirtime } from "@/lib/vtpass";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      serviceID?: string;
      phone?: string;
      amount?: number | string;
      saveBeneficiary?: boolean;
      mode?: "local" | "international";
      operatorId?: string;
      countryIso?: string;
      productTypeId?: string | number;
      variationCode?: string;
    };

    const amount = Number(body.amount);
    if (!body.phone) {
      return NextResponse.json({ error: "Phone is required" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Enter a valid amount" },
        { status: 400 },
      );
    }

    const mode = body.mode ?? "local";
    if (mode === "local" && !body.serviceID) {
      return NextResponse.json(
        { error: "Select a network" },
        { status: 400 },
      );
    }
    if (
      mode === "international" &&
      (!body.operatorId ||
        !body.countryIso ||
        !body.productTypeId ||
        !body.variationCode)
    ) {
      return NextResponse.json(
        { error: "Complete international airtime selection" },
        { status: 400 },
      );
    }

    const result = await purchaseAirtime({
      userId: user.id,
      countryCode: user.countryCode,
      serviceID: body.serviceID || "foreign-airtime",
      phone: body.phone,
      amount,
      saveBeneficiary: body.saveBeneficiary,
      mode,
      email: user.email,
      operatorId: body.operatorId,
      countryIso: body.countryIso,
      productTypeId: body.productTypeId,
      variationCode: body.variationCode,
    });

    const amountFormatted = formatMoney(
      result.order.amount,
      result.wallet.currency,
    );

    try {
      await createNotification({
        userId: user.id,
        title:
          result.status === "completed"
            ? "Airtime sent"
            : "Airtime processing",
        body: `${amountFormatted} airtime to ${body.phone}. Ref ${result.requestId}`,
        type: "airtime",
        metadata: {
          href: `/history/${result.transactionId}`,
          transactionId: result.transactionId,
          orderId: result.order.id,
        },
      });
    } catch (notifyError) {
      console.error("[vtpass-airtime-notify]", notifyError);
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      simulated: result.simulated,
      wallet: result.wallet,
      orderId: result.order.id,
      transactionId: result.transactionId,
      requestId: result.requestId,
      cashback: result.cashback,
      amountFormatted,
      message:
        result.status === "completed"
          ? "Airtime purchased successfully"
          : "Airtime is processing",
    });
  } catch (error) {
    console.error("[vtpass-airtime]", error);
    const raw =
      error instanceof Error ? error.message : "Airtime purchase failed";
    return NextResponse.json(
      {
        error: raw
          .replace(/VTpass/gi, "ORYNO")
          .replace(/vtpass/gi, "ORYNO"),
      },
      { status: 400 },
    );
  }
}
