import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry } from "@/lib/wallet";
import {
  convertWalletCurrency,
  initiateUsdPaystackFund,
} from "@/lib/wallet-usd";
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
      method?: "paystack" | "convert";
      callbackUrl?: string;
    };

    const method = body.method ?? "paystack";
    const localCurrency = currencyForCountry(user.countryCode);

    if (method === "convert") {
      // Convert local → USD using local amount derived from desired USD
      // Client sends USD amount; we convert by debiting the local cost.
      const { localToBuyUsd, quoteLocalUsd } = await import("@/lib/fx/rates");
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
      : `${origin.replace(/\/$/, "")}/wallet?usd_fund=1`;

    const email =
      user.email ||
      `${user.id.replace(/-/g, "").slice(0, 12)}@oryno.users`;

    const result = await initiateUsdPaystackFund({
      userId: user.id,
      email,
      localCurrency,
      usdAmount: body.amountUsd ?? 0,
      callbackUrl,
    });

    return NextResponse.json({
      ok: true,
      method: "paystack",
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
        error:
          error instanceof Error ? error.message : "Failed to fund USD wallet",
      },
      { status: 400 },
    );
  }
}
