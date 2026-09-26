import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import { japErrorToEnglish, purchaseJapBoost } from "@/lib/jap";
import { actionLockHttpStatus } from "@/lib/wallet/action-lock";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const started = Date.now();
  const step = (name: string, extra?: Record<string, unknown>) => {
    console.log("[boost]", name, { ms: Date.now() - started, ...extra });
  };
  step("request received");
  try {
    const user = await ensureAppUser();
    step("user loaded", { userId: user?.id ?? null });
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

    step("body ok", {
      serviceId: body.serviceId,
      platform: body.platform,
      metric: body.metric,
      quantity: body.quantity,
      hasComments,
    });

    step("waiting for wallet lock");
    const { withUserActionLock } = await import("@/lib/wallet/action-lock");
    const result = await withUserActionLock(user.id, () =>
      purchaseJapBoost({
        userId: user.id,
        countryCode: user.countryCode,
        serviceId: Number(body.serviceId),
        serviceName: body.serviceName!.trim(),
        platform: body.platform || "Other",
        metric: body.metric || "Boost",
        link: body.link!.trim(),
        quantity: Number(body.quantity) || 0,
        rateUsd: Number(body.rateUsd) || undefined,
        priceLocal: Number(body.priceLocal) || undefined,
        comments: body.comments,
      }),
    );

    step("order placed", {
      orderId: result.orderId,
      transactionId: result.transactionId,
    });

    const amountFormatted = formatMoney(result.amount, result.currency);

    try {
      await createNotification({
        userId: user.id,
        title: "Boost ordered",
        body: `${result.quantity.toLocaleString()} ${result.metric} for ${result.platform} is processing`,
        type: "social",
        metadata: {
          href: `/history/${result.transactionId}`,
          orderId: result.orderId,
          transactionId: result.transactionId,
        },
      });
    } catch (e) {
      console.error("[jap-purchase-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: false,
      provider: "jap",
      orderId: result.orderId,
      socialOrderId: result.socialOrderId,
      transactionId: result.transactionId,
      wallet: result.wallet,
      amountFormatted,
      message: "Boost ordered successfully",
    });
  } catch (error) {
    console.error("[boost] purchase failed", {
      ms: Date.now() - started,
      error,
    });
    const raw =
      error instanceof Error ? error.message : "Failed to place boost";
    return NextResponse.json(
      { error: japErrorToEnglish(raw) },
      { status: actionLockHttpStatus(error) || 400 },
    );
  }
}
