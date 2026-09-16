import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import {
  buyGiftCard,
  reloadlyBuyErrorCode,
  reloadlyBuyHttpStatus,
  reloadlyErrorToEnglish,
} from "@/lib/reloadly";
import { formatCountryMoney } from "@/lib/country";
import { getDisplayFx } from "@/lib/display-currency";
import { convertNgnToLocal } from "@/lib/fx/rates";
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
      productId?: number;
      unitPrice?: number;
      email?: string;
      quantity?: number;
      countryCode?: string;
    };

    const productId = Number(body.productId);
    const unitPrice = Number(body.unitPrice);
    if (!Number.isFinite(productId) || productId <= 0) {
      return NextResponse.json({ error: "Select a gift card" }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: "Select an amount" }, { status: 400 });
    }

    const email = (body.email || user.email || "").trim();
    if (!email) {
      return NextResponse.json(
        { error: "Enter an email to receive the card" },
        { status: 400 },
      );
    }

    const result = await withUserActionLock(user.id, () =>
      buyGiftCard({
        userId: user.id,
        countryCode: user.countryCode,
        email,
        displayName: user.fullName || "ORYNO",
        productId,
        unitPrice,
        quantity: body.quantity || 1,
        productCountryCode: body.countryCode,
      }),
    );
    const fx = await getDisplayFx(user.countryCode);
    const amountFormatted = formatCountryMoney(
      convertNgnToLocal(result.amount, fx.ngnToLocal),
      user.countryCode,
    );

    try {
      await createNotification({
        userId: user.id,
        title: "Gift card purchased",
        body: `${result.product.brandName} · ${amountFormatted}`,
        type: "gift_card",
        metadata: {
          href: `/history/${result.transactionId}`,
          transactionId: result.transactionId,
          reference: result.reference,
        },
      });
    } catch (e) {
      console.error("[reloadly-buy-notify]", e);
    }

    return NextResponse.json({
      ok: true,
      simulated: result.simulated,
      reference: result.reference,
      transactionId: result.transactionId,
      providerTransactionId: result.providerTransactionId,
      amount: result.amount,
      amountFormatted,
      currency: fx.to,
      wallet: result.wallet,
      cards: result.cards,
      product: result.product,
      message: result.message,
    });
  } catch (error) {
    console.error("[reloadly-buy]", error);
    const raw =
      error instanceof Error ? error.message : "Failed to buy gift card";
    const code = reloadlyBuyErrorCode(raw);
    const message = reloadlyErrorToEnglish(raw);
    return NextResponse.json(
      { error: message, code },
      {
        status:
          actionLockHttpStatus(error) || reloadlyBuyHttpStatus(raw),
      },
    );
  }
}
