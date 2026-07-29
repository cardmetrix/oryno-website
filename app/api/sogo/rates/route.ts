import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  extractNgnRate,
  fetchSogoSellRates,
  isSogoDemoMode,
  quoteGiftCardSell,
  sogoErrorToEnglish,
  sogoSellPayoutShare,
} from "@/lib/sogo";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug") || undefined;
    const cardCurrency = (searchParams.get("currency") || "USD").toUpperCase();
    const cardType = (searchParams.get("cardType") || "ecode") as
      | "ecode"
      | "physical";
    const subType = searchParams.get("subType") as
      | "cash_receipt"
      | "debit_receipt"
      | "no_receipt"
      | null;
    const amount = Number(searchParams.get("amount") || "0");

    const rates = await fetchSogoSellRates(slug);

    if (slug && amount > 0) {
      const quote = await quoteGiftCardSell({
        slug,
        cardCurrency,
        cardType,
        subType,
        cardAmount: amount,
      });
      return NextResponse.json({
        rates,
        quote,
        payoutShare: sogoSellPayoutShare(),
        demo: isSogoDemoMode(),
        source: isSogoDemoMode() ? "demo" : "provider",
      });
    }

    const simplified = rates.map((entry) => {
      const rate =
        extractNgnRate({
          entry,
          currency: cardCurrency,
          cardType,
          subType,
        }) ??
        extractNgnRate({
          entry,
          currency: "USD",
          cardType: "ecode",
        });
      return {
        slug: entry.slug,
        name: entry.name,
        ratePerUnit: rate,
        currency: "NGN",
      };
    });

    return NextResponse.json({
      rates,
      simplified,
      payoutShare: sogoSellPayoutShare(),
      demo: isSogoDemoMode(),
      source: isSogoDemoMode() ? "demo" : "provider",
    });
  } catch (error) {
    console.error("[sogo-rates]", error);
    return NextResponse.json(
      {
        error: sogoErrorToEnglish(
          error instanceof Error ? error.message : "Failed to load rates",
        ),
      },
      { status: 400 },
    );
  }
}
