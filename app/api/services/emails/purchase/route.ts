import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import {
  fivesimErrorToEnglish,
  isFivesimLive,
  purchaseFivesimNumber,
  resolveFivesimProduct,
} from "@/lib/fivesim";
import { publicServiceError } from "@/lib/service-errors";
import { actionLockHttpStatus } from "@/lib/wallet/action-lock";

export const runtime = "nodejs";

/** Rent Email buys a 5sim SMS number for mailbox signup. */
export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isFivesimLive()) {
      return NextResponse.json(
        {
          error:
            "Email signup numbers require FIVESIM_API_KEY with FIVESIM_DEMO=false.",
        },
        { status: 503 },
      );
    }

    const body = (await req.json()) as {
      site?: string;
      domain?: string;
      service?: string;
      serviceName?: string;
      countrySlug?: string;
      countryName?: string;
      iso?: string | null;
      priceUsd?: number;
      costUsd?: number;
      priceLocal?: number;
    };

    const service = resolveFivesimProduct(
      (body.service || body.site || "").trim(),
    );
    const countrySlug = (body.countrySlug || body.domain || "")
      .trim()
      .toLowerCase();
    const countryName = (body.countryName || countrySlug).trim();

    if (!service || !countrySlug) {
      return NextResponse.json(
        { error: "Select an email service and country" },
        { status: 400 },
      );
    }

    const costUsd = Number(body.costUsd);
    const retailUsd = Number(body.priceUsd);
    const chargeUsd =
      Number.isFinite(retailUsd) && retailUsd > 0
        ? retailUsd
        : Number.isFinite(costUsd) && costUsd > 0
          ? costUsd
          : NaN;
    if (!Number.isFinite(chargeUsd) || chargeUsd <= 0) {
      return NextResponse.json(
        { error: "Invalid price — refresh and try again" },
        { status: 400 },
      );
    }

    const { withSpendLock } = await import("@/lib/wallet/action-lock");
    const result = await withSpendLock(
      user.id,
      Number(body.priceLocal) || 0,
      user.countryCode,
      () =>
        purchaseFivesimNumber({
          userId: user.id,
          countryCode: user.countryCode,
          countrySlug,
          countryName,
          iso: body.iso ?? null,
          service,
          serviceName: body.serviceName || service,
          operator: "any",
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
        title: "Email signup number ready",
        body: `${result.phoneNumber} for ${body.serviceName || service}`,
        type: "email",
        metadata: {
          href: "/services/emails",
          activationId: result.activationId,
          transactionId: result.transactionId,
          provider: "fivesim",
        },
      });
    } catch (e) {
      console.error("[rent-email-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      email: result.phoneNumber,
      emailId: result.activationId,
      phoneNumber: result.phoneNumber,
      activationId: result.activationId,
      site: service,
      domain: countrySlug,
      service,
      serviceName: body.serviceName || service,
      transactionId: result.transactionId,
      wallet: result.wallet,
      amountFormatted,
      message: "Number reserved — wait for SMS code",
      provider: "fivesim",
    });
  } catch (error) {
    console.error("[rent-email-purchase-5sim]", error);
    const errorMessage = publicServiceError(
      fivesimErrorToEnglish(
        error instanceof Error ? error.message : "Failed to rent number",
      ),
    );
    return NextResponse.json(
      {
        error: errorMessage,
        code: actionLockHttpStatus(error)
          ? "action_in_progress"
          : "PURCHASE_FAILED",
      },
      { status: actionLockHttpStatus(error) || 400 },
    );
  }
}
