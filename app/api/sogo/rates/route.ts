import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getSogoPayoutShare } from "@/lib/pricing/service-pricing";
import {
  extractNgnRate,
  fetchSogoSellRates,
  isSogoDemoMode,
  isSogoGiftCardsPartnerLive,
  isSogoSellRatesFromProvider,
  quoteGiftCardSell,
  sogoErrorToEnglish,
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
    const payoutShare = await getSogoPayoutShare();

    const rates = await fetchSogoSellRates(slug);
    const demo = isSogoDemoMode();
    const partnerLive = isSogoGiftCardsPartnerLive();
    const ratesFromProvider = isSogoSellRatesFromProvider();
    const unavailable = !demo && (!partnerLive || !ratesFromProvider);
    const source = demo
      ? "demo"
      : ratesFromProvider
        ? "provider"
        : "fallback";

    if (slug && amount > 0) {
      try {
        const quote = await quoteGiftCardSell({
          slug,
          cardCurrency,
          cardType,
          subType,
          cardAmount: amount,
          requireLive: false,
        });
        return NextResponse.json({
          rates,
          quote,
          payoutShare,
          demo,
          unavailable: unavailable || !quote.live,
          source: quote.live ? "provider" : source,
        });
      } catch (quoteError) {
        console.error("[sogo-rates-quote]", quoteError);
        return NextResponse.json({
          rates,
          quote: null,
          payoutShare,
          demo,
          unavailable: true,
          source,
          error: sogoErrorToEnglish(
            quoteError instanceof Error
              ? quoteError.message
              : "Failed to quote this card",
          ),
        });
      }
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
      payoutShare,
      demo,
      unavailable,
      source,
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
