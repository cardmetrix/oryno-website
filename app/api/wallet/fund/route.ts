import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { createNotification } from "@/lib/notifications-service";
import { formatMoney } from "@/lib/transactions";
import {
  currencyForCountry,
  fundWallet,
  type FundingMethod,
  toWalletSummary,
} from "@/lib/wallet";

export const runtime = "nodejs";

const METHOD_MAP: Record<string, FundingMethod> = {
  card: "card",
  transfer: "bank_transfer",
  bank_transfer: "bank_transfer",
  ussd: "ussd",
  mobile_money: "mobile_money",
};

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      amount?: string | number;
      method?: string;
    };

    const method = METHOD_MAP[(body.method ?? "card").toLowerCase()];
    if (!method) {
      return NextResponse.json(
        { error: "Unsupported payment method" },
        { status: 400 },
      );
    }

    const result = await fundWallet({
      userId: user.id,
      amount: body.amount ?? 0,
      method,
      countryCode: user.countryCode,
      currency: currencyForCountry(user.countryCode),
    });

    const amountFormatted = formatMoney(
      result.funding.amount,
      result.funding.currency,
    );

    try {
      await createNotification({
        userId: user.id,
        title: "Wallet funded",
        body: `${amountFormatted} was added to your wallet. Ref ${result.funding.externalRef ?? "—"}`,
        type: "fund",
        metadata: {
          href: "/wallet",
          fundingId: result.funding.id,
          transactionId: result.transaction.id,
        },
      });
    } catch (notifyError) {
      console.error("[wallet-fund-notify]", notifyError);
    }

    return NextResponse.json({
      ok: true,
      message: "Wallet funded successfully",
      wallet: toWalletSummary(result.wallet),
      fundingId: result.funding.id,
      transactionId: result.transaction.id,
      amountFormatted,
      reference: result.funding.externalRef,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fund wallet";
    console.error("[wallet-fund]", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
