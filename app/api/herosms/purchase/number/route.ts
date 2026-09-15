import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import {
  fivesimErrorToEnglish,
  isFivesimLive,
  numbersProvider,
  purchaseFivesimNumber,
} from "@/lib/fivesim";
import { purchaseVirtualNumber, herosmsErrorToEnglish } from "@/lib/herosms";
import { actionLockHttpStatus } from "@/lib/wallet/action-lock";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      heroCountryId?: number;
      countrySlug?: string;
      countryName?: string;
      iso?: string | null;
      service?: string;
      serviceName?: string;
      operator?: string;
      priceUsd?: number;
      costUsd?: number;
      priceLocal?: number;
    };

    if (!body.countryName?.trim() || !body.service?.trim()) {
      return NextResponse.json(
        { error: "Select a country and service" },
        { status: 400 },
      );
    }

    const costUsd = Number(body.costUsd);
    const priceUsd = Number(body.priceUsd);
    const chargeUsd =
      Number.isFinite(priceUsd) && priceUsd > 0
        ? priceUsd
        : Number.isFinite(costUsd) && costUsd > 0
          ? costUsd
          : NaN;
    if (!Number.isFinite(chargeUsd) || chargeUsd <= 0) {
      return NextResponse.json(
        { error: "Invalid price — refresh and try again" },
        { status: 400 },
      );
    }

    const provider = numbersProvider();
    const { withSpendLock } = await import("@/lib/wallet/action-lock");

    if (provider === "fivesim") {
      if (!isFivesimLive()) {
        return NextResponse.json(
          {
            error:
              "Virtual numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
          },
          { status: 503 },
        );
      }
      const countrySlug = (body.countrySlug || "").trim().toLowerCase();
      if (!countrySlug) {
        return NextResponse.json(
          { error: "Select a country (refresh offers and try again)" },
          { status: 400 },
        );
      }

      const result = await withSpendLock(
        user.id,
        Number(body.priceLocal) || 0,
        user.countryCode,
        () =>
          purchaseFivesimNumber({
            userId: user.id,
            countryCode: user.countryCode,
            countrySlug,
            countryName: body.countryName!.trim(),
            iso: body.iso,
            service: body.service!.trim(),
            serviceName: body.serviceName || body.service!,
            operator: body.operator,
            priceUsd: chargeUsd,
            costUsd:
              Number.isFinite(costUsd) && costUsd > 0 ? costUsd : undefined,
            priceLocal: Number(body.priceLocal) || 0,
          }),
      );

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
            provider: "fivesim",
          },
        });
      } catch (e) {
        console.error("[5sim-number-notify]", e);
      }

      return NextResponse.json({
        ok: true,
        simulated: result.simulated,
        provider: "fivesim",
        phoneNumber: result.phoneNumber,
        activationId: result.activationId,
        numberId: result.number.id,
        transactionId: result.transactionId,
        wallet: result.wallet,
        amountFormatted,
        message: "Number purchased — waiting for SMS code",
      });
    }

    if (
      body.heroCountryId == null ||
      !Number.isFinite(Number(body.heroCountryId))
    ) {
      return NextResponse.json(
        { error: "Select a country and service" },
        { status: 400 },
      );
    }

    const result = await withSpendLock(
      user.id,
      Number(body.priceLocal) || 0,
      user.countryCode,
      () =>
        purchaseVirtualNumber({
          userId: user.id,
          countryCode: user.countryCode,
          heroCountryId: Number(body.heroCountryId),
          countryName: body.countryName!,
          iso: body.iso,
          service: body.service!,
          serviceName: body.serviceName || body.service!,
          priceUsd: chargeUsd,
          costUsd: Number.isFinite(costUsd) && costUsd > 0 ? costUsd : undefined,
          priceLocal: Number(body.priceLocal) || 0,
        }),
    );

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
      provider: "herosms",
      phoneNumber: result.phoneNumber,
      activationId: result.activationId,
      numberId: result.number.id,
      transactionId: result.transactionId,
      wallet: result.wallet,
      amountFormatted,
      message: "Number purchased — waiting for SMS code",
    });
  } catch (error) {
    console.error("[numbers-purchase]", error);
    const provider = numbersProvider();
    return NextResponse.json(
      {
        error:
          provider === "fivesim"
            ? fivesimErrorToEnglish(
                error instanceof Error ? error.message : "Failed to buy number",
              )
            : herosmsErrorToEnglish(
                error instanceof Error ? error.message : "Failed to buy number",
              ),
      },
      { status: actionLockHttpStatus(error) || 400 },
    );
  }
}
