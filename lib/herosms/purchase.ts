import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  userVirtualNumbers,
  virtualNumberOffers,
  wallets,
} from "@/lib/db/schema";
import { convertLocalToNgn, roundMoney } from "@/lib/fx/rates";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { usdFromLocalRetail } from "@/lib/pricing/service-pricing";
import { debitUsdWallet } from "@/lib/wallet-usd";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import { getDisplayFx, nigeriaServiceLedgerCurrency } from "@/lib/display-currency";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  assertHerosmsReady,
  getHerosmsNumber,
  getHerosmsStatus,
  herosmsMarkup,
  isHerosmsDemoMode,
  isHerosmsLive,
  setHerosmsStatus,
} from "./client";
import { countryFlagEmoji } from "./countries";
import { herosmsErrorToEnglish } from "./errors";
import { notifyServiceEvent } from "@/lib/notify/service-events";

const LOG_PREFIX = "[herosms]";

async function debitWallet(input: {
  userId: string;
  countryCode?: string | null;
  amount: number;
  category: "virtual_number" | "other";
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const ledgerCurrency = nigeriaServiceLedgerCurrency();
  const wallet = await ensurePrimaryWallet(input.userId, ledgerCurrency);
  const fx = await getDisplayFx(input.countryCode);
  const ledgerAmount =
    fx.to === "NGN"
      ? input.amount
      : convertLocalToNgn(input.amount, fx.localToNgn);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("Wallet is not available for payments");
  }

  const amountStr = ledgerAmount.toFixed(2);

  return db.transaction(async (tx) => {
    const current = await tx.query.wallets.findFirst({
      where: eq(wallets.id, wallet.id),
    });
    if (!current) throw new Error("Wallet not found");
    if (Number(current.balance) < ledgerAmount) {
      throw new Error("Insufficient wallet balance");
    }

    const next = (Number(current.balance) - ledgerAmount).toFixed(2);
    const [updated] = await tx
      .update(wallets)
      .set({ balance: next, updatedAt: new Date() })
      .where(eq(wallets.id, current.id))
      .returning();

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: current.id,
        type: "debit",
        category: input.category,
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency: ledgerCurrency,
        status: "processing",
        balanceAfter: next,
        metadata: {
          provider: "herosms",
          ...(input.metadata ?? {}),
        },
      })
      .returning();

    return {
      wallet: updated ?? { ...current, balance: next },
      transaction: txRow,
      amount: ledgerAmount,
      currency: ledgerCurrency,
    };
  });
}

async function refundDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
}) {
  await refundFailedDebit(input);
}

export async function usdToLocalPrice(
  usd: number,
  countryCode?: string | null,
  serviceKey?: string | null,
  source?: "virtual_number" | "email",
) {
  const currency = currencyForCountry(countryCode);
  const quote = await quoteLocalUsd(currency);
  const { priceUsdToLocal } = await import("@/lib/pricing/service-pricing");
  const priced = await priceUsdToLocal({
    provider: "herosms",
    serviceKey,
    usd,
    buyRate: quote.buyRate,
    source: source ?? "virtual_number",
  });
  return {
    local: priced.local,
    currency,
    quote,
    markup: priced.markup,
    companyCharge: priced.companyCharge,
  };
}

/** Retail USD for numbers — local retail (markup + app buyRate) converted back at that rate. */
export async function usdRetailNumberPrice(
  usd: number,
  countryCode?: string | null,
  serviceKey?: string | null,
) {
  const priced = await usdToLocalPrice(usd, countryCode, serviceKey);
  return {
    usd: usdFromLocalRetail(priced.local, priced.quote.buyRate),
    local: priced.local,
    currency: "USD" as const,
    localCurrency: priced.currency,
    quote: priced.quote,
    markup: priced.markup,
    companyCharge: priced.companyCharge,
  };
}

async function ensureOffer(input: {
  countryCode: string;
  countryName: string;
  iso?: string | null;
  service: string;
  serviceName: string;
  price: number;
  currency: string;
}) {
  const category = `${input.serviceName} · SMS`.slice(0, 80);
  const existing = await db.query.virtualNumberOffers.findFirst({
    where: and(
      eq(virtualNumberOffers.countryCode, input.countryCode),
      eq(virtualNumberOffers.category, category),
      eq(virtualNumberOffers.type, "rent"),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(virtualNumberOffers)
    .values({
      countryCode: input.countryCode.slice(0, 2).toUpperCase(),
      countryName: input.countryName.slice(0, 120),
      flagEmoji: input.iso ? countryFlagEmoji(input.iso) : "🏳️",
      type: "rent",
      category,
      price: input.price.toFixed(2),
      currency: input.currency,
      duration: "Until SMS / ~20 min",
      smsCapable: true,
      stockBuy: 0,
      stockRent: 100,
      active: true,
    })
    .returning();

  return created;
}

export async function purchaseVirtualNumber(input: {
  userId: string;
  countryCode?: string | null;
  heroCountryId: number;
  countryName: string;
  iso?: string | null;
  service: string;
  serviceName: string;
  /** HeroSMS wholesale USD. Prefer costUsd when the client also posts retail priceUsd. */
  priceUsd: number;
  costUsd?: number;
  priceLocal: number;
}) {
  const wholesaleUsd =
    Number.isFinite(input.costUsd) && (input.costUsd as number) > 0
      ? (input.costUsd as number)
      : input.priceUsd;
  const serviceKey = `${input.heroCountryId}:${input.service}`;
  const { usd, local, quote, companyCharge } = await usdRetailNumberPrice(
    wholesaleUsd,
    input.countryCode,
    serviceKey,
  );
  const chargeAmount = usd;
  const currency = "USD";

  const offer = await ensureOffer({
    countryCode: (input.iso || input.countryCode || "NG").slice(0, 2).toUpperCase(),
    countryName: input.countryName,
    iso: input.iso,
    service: input.service,
    serviceName: input.serviceName,
    price: chargeAmount,
    currency,
  });

  if (!offer?.id) {
    throw new Error("Unable to prepare this number offer. Please try again.");
  }

  console.log(LOG_PREFIX, "purchase number start", {
    live: isHerosmsLive(),
    service: input.service,
    heroCountryId: input.heroCountryId,
    wholesaleUsd,
    chargeAmount,
    currency,
    buyRate: quote.buyRate,
  });

  // Fail before debiting wallet when live provider is down / empty
  if (!isHerosmsDemoMode()) {
    await assertHerosmsReady(Math.max(0.01, wholesaleUsd * 0.5));
  }

  const prepared = await debitUsdWallet({
    userId: input.userId,
    amount: chargeAmount,
    category: "virtual_number",
    title: `${input.serviceName} number`,
    subtitle: input.countryName,
    metadata: {
      provider: "herosms",
      service: input.service,
      heroCountryId: input.heroCountryId,
      costUsd: wholesaleUsd,
      priceUsd: chargeAmount,
      priceLocal: local,
      buyRate: quote.buyRate,
    },
  });

  try {
    let activationId: string;
    let phoneNumber: string;
    let simulated = false;

    if (isHerosmsDemoMode()) {
      throw new Error(
        "HeroSMS is not configured for live purchases. Set HEROSMS_API_KEY and HEROSMS_DEMO=false.",
      );
    }
    const num = await getHerosmsNumber({
      service: input.service,
      country: input.heroCountryId,
      maxPrice: wholesaleUsd * 1.25,
    });
    activationId = num.activationId;
    phoneNumber = num.phoneNumber;
    console.log(LOG_PREFIX, "purchase number LIVE", {
      activationId,
      phoneNumber,
    });
    // Mark ready to receive SMS
    try {
      await setHerosmsStatus(activationId, 1);
    } catch (e) {
      console.warn(LOG_PREFIX, "setStatus(1) non-fatal", e);
    }

    const [row] = await db
      .insert(userVirtualNumbers)
      .values({
        userId: input.userId,
        offerId: offer.id,
        phoneNumber,
        type: "rent",
        status: "processing",
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        transactionId: prepared.transaction.id,
      })
      .returning();

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: activationId,
        relatedOrderId: row.id,
        relatedOrderType: "virtual_number",
        updatedAt: new Date(),
        metadata: {
          provider: "herosms",
          activationId,
          phoneNumber,
          service: input.service,
          simulated,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

    try {
      const { recognizeUsdServiceProfit } = await import("@/lib/company/recognize");
      const chargeUsd = roundMoney(
        companyCharge > 0 ? companyCharge / quote.buyRate : 0,
      );
      await recognizeUsdServiceProfit({
        source: "virtual_number",
        transactionId: prepared.transaction.id,
        userId: input.userId,
        customerUsd: chargeAmount,
        providerUsd: wholesaleUsd,
        chargeUsd: Math.max(0, chargeUsd),
        description: `${input.serviceName} virtual number`,
        metadata: {
          service: input.service,
          heroCountryId: input.heroCountryId,
        },
      });
    } catch (revenueError) {
      console.error("[herosms-revenue]", revenueError);
    }

    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);

    return {
      number: row,
      phoneNumber,
      activationId,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      amount: chargeAmount,
      currency,
      simulated,
    };
  } catch (error) {
    const reason = herosmsErrorToEnglish(
      error instanceof Error ? error.message : "Purchase failed",
    );
    console.error(LOG_PREFIX, "purchase number failed — refunding", reason);
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    throw new Error(reason);
  }
}
