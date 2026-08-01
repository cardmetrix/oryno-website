import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import { purchaseVirtualNumber, herosmsErrorToEnglish } from "@/lib/herosms";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      heroCountryId?: number;
      countryName?: string;
      iso?: string | null;
      service?: string;
      serviceName?: string;
      priceUsd?: number;
      priceLocal?: number;
    };

    if (
      body.heroCountryId == null ||
      !Number.isFinite(Number(body.heroCountryId)) ||
      !body.countryName?.trim() ||
      !body.service?.trim()
    ) {
      return NextResponse.json(
        { error: "Select a country and service" },
        { status: 400 },
      );
    }

    const priceUsd = Number(body.priceUsd);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
      return NextResponse.json(
        { error: "Invalid price — refresh and try again" },
        { status: 400 },
      );
    }

    console.log("[herosms-purchase-number] request", {
      heroCountryId: body.heroCountryId,
      service: body.service,
      priceUsd,
    });

    const result = await purchaseVirtualNumber({
      userId: user.id,
      countryCode: user.countryCode,
      heroCountryId: Number(body.heroCountryId),
      countryName: body.countryName,
      iso: body.iso,
      service: body.service,
      serviceName: body.serviceName || body.service,
      priceUsd,
      priceLocal: Number(body.priceLocal) || 0,
    });

    console.log("[herosms-purchase-number] ok", {
      simulated: result.simulated,
      activationId: result.activationId,
      phoneNumber: result.phoneNumber,
    });

    const amountFormatted = formatMoney(result.amount, result.currency);

    try {
      await createNotification({
        userId: user.id,
        title: "Virtual number ready",
        body: `${result.phoneNumber} · ${body.serviceName || body.service}. Waiting for SMS.`,
        type: "virtual_number",
        metadata: {
          href: "/services/virtual-numbers",
          activationId: result.activationId,
          transactionId: result.transactionId,
        },
      });
    } catch (e) {
      console.error("[herosms-number-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      phoneNumber: result.phoneNumber,
      activationId: result.activationId,
      numberId: result.number.id,
      transactionId: result.transactionId,
      wallet: result.wallet,
      amountFormatted,
      message: "Number purchased — waiting for SMS code",
    });
  } catch (error) {
    console.error("[herosms-purchase-number]", error);
    return NextResponse.json(
      {
        error: herosmsErrorToEnglish(
          error instanceof Error ? error.message : "Failed to buy number",
        ),
      },
      { status: 400 },
    );
  }
}
