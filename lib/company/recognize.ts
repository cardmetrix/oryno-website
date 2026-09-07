import { recognizeRevenueSafe } from "@/lib/company/revenue";
import { getUsdMidRate, roundMoney } from "@/lib/fx/rates";
import type { FxQuote } from "@/lib/fx/rates";

export async function recognizeFxProfit(input: {
  transactionId: string;
  userId: string;
  localCurrency: string;
  direction: "to_usd" | "to_local" | "usd_fund";
  localAmount: number;
  usdAmount: number;
  quote: FxQuote;
}) {
  const midLocal = roundMoney(input.usdAmount * input.quote.midRate);
  const spread =
    input.direction === "to_local"
      ? roundMoney(midLocal - input.localAmount)
      : roundMoney(input.localAmount - midLocal);

  if (spread <= 0) return null;

  return recognizeRevenueSafe({
    source: "fx_conversion",
    transactionId: input.transactionId,
    userId: input.userId,
    currency: input.localCurrency,
    grossIn:
      input.direction === "to_local" ? midLocal : input.localAmount,
    grossOut:
      input.direction === "to_local" ? input.localAmount : midLocal,
    fxSpreadAmount: spread,
    chargeAmount: 0,
    markupAmount: 0,
    description:
      input.direction === "usd_fund"
        ? `USD wallet fund spread (${input.localCurrency})`
        : `Wallet conversion ${input.direction}`,
    metadata: {
      direction: input.direction,
      usdAmount: input.usdAmount,
      localAmount: input.localAmount,
      midRate: input.quote.midRate,
      buyRate: input.quote.buyRate,
      sellRate: input.quote.sellRate,
    },
  });
}

export async function recognizeUsdServiceProfit(input: {
  source: "virtual_number" | "social";
  transactionId: string;
  userId: string;
  customerUsd: number;
  providerUsd: number;
  chargeUsd?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  const customerUsd = roundMoney(input.customerUsd);
  const providerUsd = roundMoney(input.providerUsd);
  const markup = roundMoney(
    Math.max(0, customerUsd - providerUsd - (input.chargeUsd ?? 0)),
  );
  return recognizeRevenueSafe({
    source: input.source,
    transactionId: input.transactionId,
    userId: input.userId,
    currency: "USD",
    grossIn: customerUsd,
    grossOut: providerUsd,
    markupAmount: markup,
    chargeAmount: roundMoney(input.chargeUsd ?? 0),
    description: input.description,
    metadata: input.metadata,
  });
}

export async function recognizeNgnServiceProfit(input: {
  source: "gift_card_buy" | "gift_card_sell" | "email" | "withdraw";
  transactionId: string;
  userId?: string | null;
  grossIn: number;
  grossOut: number;
  chargeAmount?: number;
  markupAmount?: number;
  fxSpreadAmount?: number;
  description?: string;
  metadata?: Record<string, unknown>;
}) {
  return recognizeRevenueSafe({
    source: input.source,
    transactionId: input.transactionId,
    userId: input.userId,
    currency: "NGN",
    grossIn: roundMoney(input.grossIn),
    grossOut: roundMoney(input.grossOut),
    chargeAmount: roundMoney(input.chargeAmount ?? 0),
    markupAmount: roundMoney(input.markupAmount ?? 0),
    fxSpreadAmount: roundMoney(input.fxSpreadAmount ?? 0),
    description: input.description,
    metadata: input.metadata,
  });
}

export async function ngnValueOfUsd(usd: number) {
  const { midRate } = await getUsdMidRate("NGN");
  return roundMoney(usd * midRate);
}
