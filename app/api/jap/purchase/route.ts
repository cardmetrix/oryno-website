import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import { japErrorToEnglish, purchaseJapBoost } from "@/lib/jap";
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
      serviceId?: number;
      serviceName?: string;
      platform?: string;
      metric?: string;
      link?: string;
      quantity?: number;
      rateUsd?: number;
      priceLocal?: number;
      comments?: string | string[];
    };

    if (!body.serviceId || !body.serviceName?.trim()) {
      return NextResponse.json(
        { error: "Select a boost service" },
        { status: 400 },
      );
    }
    if (!body.link?.trim()) {
      return NextResponse.json(
        { error: "Profile or post link is required" },
        { status: 400 },
      );
    }
    const hasComments = Array.isArray(body.comments)
      ? body.comments.some((c) => String(c || "").trim())
      : Boolean(String(body.comments || "").trim());
    if ((!body.quantity || body.quantity <= 0) && !hasComments) {
      return NextResponse.json(
        { error: "Enter a valid quantity" },
        { status: 400 },
      );
    }

    console.log("[jap-purchase] request", {
      serviceId: body.serviceId,
      platform: body.platform,
      metric: body.metric,
      quantity: body.quantity,
      hasComments,
    });

    const { withSpendLock } = await import("@/lib/wallet/action-lock");
    const result = await withSpendLock(
      user.id,
      Number(body.priceLocal) || 0,
      user.countryCode,
      () =>
      purchaseJapBoost({
      userId: user.id,
      countryCode: user.countryCode,
      serviceId: Number(body.serviceId),
      serviceName: body.serviceName.trim(),
      platform: body.platform || "Other",
      metric: body.metric || "Boost",
      link: body.link.trim(),
      quantity: Number(body.quantity) || 0,
      rateUsd: Number(body.rateUsd) || 0,
      priceLocal: Number(body.priceLocal) || undefined,
      comments: body.comments,
      }),
    );

    console.log("[jap-purchase] ok", {
      simulated: result.simulated,
      orderId: result.orderId,
    });

    const amountFormatted = formatMoney(result.amount, result.currency);

    try {
      await createNotification({
        userId: user.id,
        title: "Boost ordered",
        body: `${body.quantity?.toLocaleString()} ${body.metric || "boost"} for ${body.platform || "social"} is processing`,
        type: "social",
        metadata: {
          href: "/services/social",
          orderId: result.orderId,
          transactionId: result.transactionId,
        },
      });
    } catch (e) {
      console.error("[jap-purchase-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      orderId: result.orderId,
      socialOrderId: result.socialOrderId,
      transactionId: result.transactionId,
      wallet: result.wallet,
      amountFormatted,
      message: result.simulated
        ? "Demo boost placed — add your API key for live orders"
        : "Boost ordered successfully",
    });
  } catch (error) {
    console.error("[jap-purchase]", error);
    const raw =
      error instanceof Error ? error.message : "Failed to place boost";
    return NextResponse.json(
      { error: japErrorToEnglish(raw) },
      { status: actionLockHttpStatus(error) || 400 },
    );
  }
}
