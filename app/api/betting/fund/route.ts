import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  bettingErrorToEnglish,
  bettingHttpStatus,
  fundBettingWallet,
} from "@/lib/betting";
import { formatCountryMoney } from "@/lib/country";
import { getDisplayFx } from "@/lib/display-currency";
import { convertLocalToNgn, convertNgnToLocal } from "@/lib/fx/rates";
import { createNotification } from "@/lib/notifications-service";
import {
  actionLockHttpStatus,
  withUserActionLock,
} from "@/lib/wallet/action-lock";

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
      customerRef?: string;
      customerId?: string;
      customerName?: string;
      amount?: number | string;
    };

    const serviceID = (body.serviceID || "").trim();
    const customerRef = (body.customerRef || body.customerId || "").trim();
    const localAmount = Number(body.amount);

    if (!serviceID || !customerRef || !Number.isFinite(localAmount)) {
      return NextResponse.json(
        { error: "Complete betting funding details" },
        { status: 400 },
      );
    }

    const fx = await getDisplayFx(user.countryCode);
    const ledgerAmount =
      fx.to === "NGN"
        ? localAmount
        : convertLocalToNgn(localAmount, fx.localToNgn);

    const { withSpendLock } = await import("@/lib/wallet/action-lock");
    const result = await withSpendLock(
      user.id,
      localAmount,
      user.countryCode,
      () =>
      fundBettingWallet({
      userId: user.id,
      countryCode: user.countryCode,
      phone: user.phone,
      serviceID,
      serviceName: body.serviceName,
      customerRef,
      customerName: body.customerName,
      amount: ledgerAmount,
      }),
    );

    const amountFormatted = formatCountryMoney(
      convertNgnToLocal(result.amount, fx.ngnToLocal),
      user.countryCode,
    );

    try {
      await createNotification({
        userId: user.id,
        title: result.simulated
          ? "Demo betting wallet funded"
          : "Betting wallet funded",
        body: `${body.serviceName || serviceID} · ${customerRef}. Ref ${result.requestId}`,
        type: "service",
        metadata: {
          href: `/history/${result.transactionId}`,
          transactionId: result.transactionId,
          orderId: result.orderId,
        },
      });
    } catch (notifyError) {
      console.error("[betting-fund-notify]", notifyError);
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      simulated: result.simulated,
      wallet: result.wallet,
      paymentId: result.orderId,
      orderId: result.orderId,
      transactionId: result.transactionId,
      requestId: result.requestId,
      amountFormatted,
      token: result.token,
      customerName: result.customerName,
      message: result.simulated
        ? "Demo betting wallet funded successfully"
        : "Betting wallet funded successfully",
    });
  } catch (error) {
    console.error("[betting-fund]", error);
    return NextResponse.json(
      {
        error: bettingErrorToEnglish(
          error instanceof Error ? error.message : "Betting funding failed",
        ),
      },
      { status: actionLockHttpStatus(error) || bettingHttpStatus(error) },
    );
  }
}
