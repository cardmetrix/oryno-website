import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry } from "@/lib/wallet";
import {
  convertWalletCurrency,
  initiateUsdWalletFund,
} from "@/lib/wallet-usd";
import { publicPaymentError } from "@/lib/flutterwave/errors";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      amountUsd?: string | number;
      method?: "checkout" | "convert";
      callbackUrl?: string;
    };

    const method =
      body.method === "convert" ? "convert" : "checkout";
    const localCurrency = currencyForCountry(user.countryCode);

    if (method === "convert") {
      const { localToBuyUsd } = await import("@/lib/fx/rates");
      const { quoteLocalUsd } = await import("@/lib/fx/customer-quote");
      const quote = await quoteLocalUsd(localCurrency);
      const usd = Number(body.amountUsd);
      if (!Number.isFinite(usd) || usd <= 0) {
        return NextResponse.json(
          { error: "Enter a valid USD amount" },
          { status: 400 },
        );
      }
      const localCost = localToBuyUsd(usd, quote.buyRate);
      const result = await convertWalletCurrency({
        userId: user.id,
        localCurrency,
        direction: "to_usd",
        amount: localCost,
      });

      return NextResponse.json({
        ok: true,
        method: "convert",
        ...result,
        fromFormatted: formatMoney(result.fromAmount, result.fromCurrency),
        toFormatted: formatMoney(result.toAmount, result.toCurrency),
        transactionId: result.creditTransactionId,
      });
    }

    const origin =
      body.callbackUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const callbackUrl = origin.includes("usd_ref=")
      ? origin
      : `${origin.replace(/\/$/, "")}/cards?usd_fund=1`;

    const email =
      user.email ||
      `${user.id.replace(/-/g, "").slice(0, 12)}@oryno.users`;

    const result = await initiateUsdWalletFund({
      userId: user.id,
      email,
      name: user.fullName,
      phone: user.phone,
      countryCode: user.countryCode,
      localCurrency,
      usdAmount: body.amountUsd ?? 0,
      callbackUrl,
    });

    return NextResponse.json({
      ok: true,
      method: "checkout",
      ...result,
      localFormatted: formatMoney(result.localAmount, result.localCurrency),
      usdFormatted: formatMoney(result.usdAmount, "USD"),
      transactionId:
        "transactionId" in result ? result.transactionId : undefined,
    });
  } catch (error) {
    console.error("[wallet-usd-fund]", error);
    return NextResponse.json(
      {
        error: publicPaymentError(
          error instanceof Error ? error.message : "Failed to fund USD wallet",
        ),
      },
      { status: 400 },
    );
  }
}
