import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { currencyForCountry } from "@/lib/wallet";
import {
  localFromSellUsd,
  localToBuyUsd,
  usdFromLocal,
} from "@/lib/fx/rates";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const localCurrency = (
      searchParams.get("currency") ||
      currencyForCountry(user.countryCode)
    ).toUpperCase();
    const amount = Number(searchParams.get("amount") || "0");
    const direction = (searchParams.get("direction") || "to_usd") as
      | "to_usd"
      | "to_local";

    const quote = await quoteLocalUsd(localCurrency);

    let preview: {
      fromAmount: number;
      fromCurrency: string;
      toAmount: number;
      toCurrency: string;
      appliedRate: number;
    } | null = null;

    if (Number.isFinite(amount) && amount > 0) {
      if (direction === "to_usd") {
        preview = {
          fromAmount: amount,
          fromCurrency: localCurrency,
          toAmount: usdFromLocal(amount, quote.buyRate),
          toCurrency: "USD",
          appliedRate: quote.buyRate,
        };
      } else {
        preview = {
          fromAmount: amount,
          fromCurrency: "USD",
          toAmount: localFromSellUsd(amount, quote.sellRate),
          toCurrency: localCurrency,
          appliedRate: quote.sellRate,
        };
      }
    }

    return NextResponse.json({
      quote,
      preview,
      examples: {
        buy1UsdCosts: localToBuyUsd(1, quote.buyRate),
        sell1UsdGets: localFromSellUsd(1, quote.sellRate),
      },
    });
  } catch (error) {
    console.error("[wallet-fx-get]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load FX rates",
      },
      { status: 400 },
    );
  }
}
