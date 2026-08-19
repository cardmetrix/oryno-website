import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import { purchaseData } from "@/lib/vtpass";
import { sogoHttpStatus } from "@/lib/sogo/errors";
import { publicServiceError } from "@/lib/service-errors";

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
      variationCode?: string;
      variationName?: string;
      amount?: number | string;
      mode?: "local" | "international";
      operatorId?: string;
      countryIso?: string;
      productTypeId?: string | number;
    };

    if (!body.phone || !body.variationCode) {
      return NextResponse.json(
        { error: "Phone and data plan are required" },
        { status: 400 },
      );
    }

    const mode = body.mode ?? "local";
    if (mode === "local" && !body.serviceID) {
      return NextResponse.json(
        { error: "Select a data network" },
        { status: 400 },
      );
    }

    const result = await purchaseData({
      userId: user.id,
      countryCode: user.countryCode,
      serviceID: body.serviceID || "foreign-airtime",
      phone: body.phone,
      variationCode: body.variationCode,
      variationName: body.variationName || body.variationCode,
      amount: Number(body.amount),
      email: user.email,
      mode,
      operatorId: body.operatorId,
      countryIso: body.countryIso,
      productTypeId: body.productTypeId,
    });

    const amountFormatted = formatMoney(
      result.order.amount,
      result.wallet.currency,
    );

    try {
      await createNotification({
        userId: user.id,
        title:
          result.status === "completed" ? "Data purchased" : "Data processing",
        body: `${body.variationName || "Data"} sent to ${body.phone}. Ref ${result.requestId}`,
        type: "data",
        metadata: {
          href: `/history/${result.transactionId}`,
          transactionId: result.transactionId,
          orderId: result.order.id,
        },
      });
    } catch (notifyError) {
      console.error("[vtpass-data-notify]", notifyError);
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      simulated: result.simulated,
      wallet: result.wallet,
      orderId: result.order.id,
      transactionId: result.transactionId,
      requestId: result.requestId,
      amountFormatted,
      message:
        result.status === "completed"
          ? "Data purchased successfully"
          : "Data purchase is processing",
    });
  } catch (error) {
    console.error("[vtpass-data]", error);
    return NextResponse.json(
      {
        error: publicServiceError(
          error instanceof Error ? error.message : "Data purchase failed",
        ),
      },
      { status: sogoHttpStatus(error) },
    );
  }
}
