import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatCountryMoney } from "@/lib/country";
import { getDisplayFx } from "@/lib/display-currency";
import { convertNgnToLocal } from "@/lib/fx/rates";
import { hubtelHttpStatus } from "@/lib/hubtel";
import { kenyaBillHttpStatus } from "@/lib/reloadly/utilities";
import { purchaseBill } from "@/lib/vtpass";
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
      serviceName?: string;
      category?: "electricity" | "tv" | "water";
      customerRef?: string;
      phone?: string;
      amount?: number | string;
      variationCode?: string;
      subscriptionType?: string;
      quantity?: number;
    };

    if (
      !body.serviceID ||
      !body.category ||
      !body.customerRef ||
      !body.variationCode
    ) {
      return NextResponse.json(
        { error: "Complete bill payment details" },
        { status: 400 },
      );
    }

    const result = await purchaseBill({
      userId: user.id,
      countryCode: user.countryCode,
      serviceID: body.serviceID,
      serviceName: body.serviceName || body.serviceID,
      category: body.category,
      customerRef: body.customerRef,
      phone: body.phone || "",
      amount: Number(body.amount),
      variationCode: body.variationCode,
      subscriptionType: body.subscriptionType,
      quantity: body.quantity,
    });

    const fx = await getDisplayFx(user.countryCode);
    const amountFormatted = formatCountryMoney(
      convertNgnToLocal(Number(result.payment.amount), fx.ngnToLocal),
      user.countryCode,
    );

    try {
      await createNotification({
        userId: user.id,
        title:
          result.status === "completed" ? "Bill paid" : "Bill processing",
        body: `${body.serviceName || "Bill"} · ${body.customerRef}. Ref ${result.requestId}`,
        type: "bill",
        metadata: {
          href: `/history/${result.transactionId}`,
          transactionId: result.transactionId,
          paymentId: result.payment.id,
        },
      });
    } catch (notifyError) {
      console.error("[vtpass-bill-notify]", notifyError);
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      simulated: result.simulated,
      wallet: result.wallet,
      paymentId: result.payment.id,
      transactionId: result.transactionId,
      requestId: result.requestId,
      amountFormatted,
      token: result.token,
      message:
        result.status === "completed"
          ? "Bill paid successfully"
          : "Bill payment is processing",
    });
  } catch (error) {
    console.error("[vtpass-bill]", error);
    return NextResponse.json(
      {
        error: publicServiceError(
          error instanceof Error ? error.message : "Bill payment failed",
        ),
      },
      { status: kenyaBillHttpStatus(error) || hubtelHttpStatus(error) || sogoHttpStatus(error) },
    );
  }
}
