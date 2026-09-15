/**
 * 5sim virtual-number purchase + status polling.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  userVirtualNumbers,
  virtualNumberOffers,
} from "@/lib/db/schema";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { roundMoney } from "@/lib/fx/rates";
import { createUsdPricer, usdFromLocalRetail } from "@/lib/pricing/service-pricing";
import { notifyServiceEvent } from "@/lib/notify/service-events";
import { currencyForCountry, toWalletSummary } from "@/lib/wallet";
import { debitUsdWallet } from "@/lib/wallet-usd";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import { countryFlagEmoji } from "@/lib/herosms/countries";
import { usdRetailNumberPrice } from "@/lib/herosms/purchase";
import {
  assertFivesimReady,
  buyFivesimActivation,
  cancelFivesimOrder,
  checkFivesimOrder,
  finishFivesimOrder,
  fivesimErrorToEnglish,
  getFivesimCountries,
  getFivesimPricesByProduct,
  isFivesimDemoMode,
  isFivesimLive,
} from "./client";
import {
  enrichCountry,
  FIVESIM_POPULAR_SERVICES,
  resolveFivesimProduct,
  type FivesimPriceOffer,
} from "./catalog";

const LOG_PREFIX = "[5sim-purchase]";

async function ensureOffer(input: {
  countryCode: string;
  countryName: string;
  iso?: string | null;
  serviceName: string;
  price: number;
  currency: string;
}) {
  const category = `${input.serviceName} · SMS`.slice(0, 80);
  const countryCode = input.countryCode.slice(0, 2).toUpperCase();
  const existing = await db.query.virtualNumberOffers.findFirst({
    where: and(
      eq(virtualNumberOffers.countryCode, countryCode),
      eq(virtualNumberOffers.category, category),
      eq(virtualNumberOffers.type, "rent"),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(virtualNumberOffers)
    .values({
      countryCode,
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

export async function listFivesimServices() {
  return FIVESIM_POPULAR_SERVICES;
}

export async function listFivesimOffers(input: {
  service: string;
  countryCode?: string | null;
  userCountryCode?: string | null;
}): Promise<{
  product: string;
  serviceName: string;
  offers: FivesimPriceOffer[];
  quote: Awaited<ReturnType<typeof quoteLocalUsd>>;
}> {
  const product = resolveFivesimProduct(input.service);
  const serviceName =
    FIVESIM_POPULAR_SERVICES.find((s) => s.code === product)?.name || product;

  const [prices, countries] = await Promise.all([
    getFivesimPricesByProduct(product),
    getFivesimCountries(),
  ]);
  const bySlug = new Map(countries.map((c) => [c.slug, c]));

  const localCurrency = currencyForCountry(input.userCountryCode);
  const quote = await quoteLocalUsd(localCurrency);
  const price = await createUsdPricer("herosms");

  const offers: FivesimPriceOffer[] = [];
  for (const row of prices) {
    const meta = bySlug.get(row.countrySlug);
    const enriched = enrichCountry(
      row.countrySlug,
      meta?.name || row.countrySlug,
      meta?.iso || null,
    );
    if (input.countryCode) {
      const filter = input.countryCode.toLowerCase();
      if (
        String(enriched.countryId) !== filter &&
        enriched.countrySlug !== filter
      ) {
        continue;
      }
    }

    const local = price({
      serviceKey: `${row.countrySlug}:${product}`,
      usd: row.cost,
      buyRate: quote.buyRate,
    });
    offers.push({
      ...enriched,
      service: product,
      serviceName,
      operator: row.operator,
      costUsd: row.cost,
      priceUsd: usdFromLocalRetail(local.local, quote.buyRate),
      priceLocal: local.local,
      currency: "USD",
      count: row.count,
    });
  }

  offers.sort((a, b) => a.priceUsd - b.priceUsd);
  return { product, serviceName, offers, quote };
}

export async function purchaseFivesimNumber(input: {
  userId: string;
  countryCode?: string | null;
  countrySlug: string;
  countryName: string;
  iso?: string | null;
  service: string;
  serviceName: string;
  operator?: string;
  priceUsd: number;
  costUsd?: number;
  priceLocal: number;
}) {
  if (isFivesimDemoMode()) {
    throw new Error(
      "5sim is not configured for live. Set FIVESIM_API_KEY and FIVESIM_DEMO=false.",
    );
  }

  const product = resolveFivesimProduct(input.service);
  const countrySlug = input.countrySlug.trim().toLowerCase();
  const wholesaleUsd =
    Number.isFinite(input.costUsd) && (input.costUsd as number) > 0
      ? (input.costUsd as number)
      : input.priceUsd;

  const serviceKey = `${countrySlug}:${product}`;
  const { usd, local, quote, companyCharge } = await usdRetailNumberPrice(
    wholesaleUsd,
    input.countryCode,
    serviceKey,
  );
  const chargeAmount = usd;

  const offer = await ensureOffer({
    countryCode: (input.iso || input.countryCode || "NG").slice(0, 2).toUpperCase(),
    countryName: input.countryName,
    iso: input.iso,
    serviceName: input.serviceName || product,
    price: chargeAmount,
    currency: "USD",
  });
  if (!offer?.id) throw new Error("Unable to prepare this number offer");

  console.log(LOG_PREFIX, "purchase start", {
    live: isFivesimLive(),
    product,
    countrySlug,
    wholesaleUsd,
    chargeAmount,
  });

  await assertFivesimReady(Math.max(0.01, wholesaleUsd * 0.5));

  const prepared = await debitUsdWallet({
    userId: input.userId,
    amount: chargeAmount,
    category: "virtual_number",
    title: `${input.serviceName || product} number`,
    subtitle: input.countryName,
    metadata: {
      provider: "fivesim",
      service: product,
      countrySlug,
      costUsd: wholesaleUsd,
      priceUsd: chargeAmount,
      priceLocal: local,
      buyRate: quote.buyRate,
    },
  });

  try {
    const bought = await buyFivesimActivation({
      country: countrySlug,
      product,
      operator: input.operator || "any",
      maxPrice: wholesaleUsd * 1.35,
    });

    console.log(LOG_PREFIX, "purchase LIVE", {
      activationId: bought.activationId,
      phone: bought.phoneNumber,
    });

    const expiresAt = bought.expires
      ? new Date(bought.expires)
      : new Date(Date.now() + 20 * 60 * 1000);

    const [row] = await db
      .insert(userVirtualNumbers)
      .values({
        userId: input.userId,
        offerId: offer.id,
        phoneNumber: bought.phoneNumber,
        type: "rent",
        status: "processing",
        expiresAt,
        transactionId: prepared.transaction.id,
      })
      .returning();

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: bought.activationId,
        relatedOrderId: row.id,
        relatedOrderType: "virtual_number",
        updatedAt: new Date(),
        metadata: {
          provider: "fivesim",
          activationId: bought.activationId,
          phoneNumber: bought.phoneNumber,
          service: product,
          countrySlug,
          operator: bought.operator,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

    try {
      const { recognizeUsdServiceProfit } = await import(
        "@/lib/company/recognize"
      );
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
        description: `${input.serviceName || product} virtual number`,
        metadata: { provider: "fivesim", service: product, countrySlug },
      });
    } catch (revenueError) {
      console.error("[5sim-revenue]", revenueError);
    }

    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);

    return {
      number: row,
      phoneNumber: bought.phoneNumber,
      activationId: bought.activationId,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      amount: chargeAmount,
      currency: "USD" as const,
      simulated: false,
    };
  } catch (error) {
    const reason = fivesimErrorToEnglish(
      error instanceof Error ? error.message : "Purchase failed",
    );
    console.error(LOG_PREFIX, "purchase failed — refunding", reason);
    await refundFailedDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    throw new Error(reason);
  }
}

export async function pollFivesimNumberStatus(
  activationId: string,
  userId?: string,
) {
  if (isFivesimDemoMode()) {
    throw new Error(
      "5sim is not configured for live. Set FIVESIM_API_KEY and FIVESIM_DEMO=false.",
    );
  }

  const result = await checkFivesimOrder(activationId);
  const status = result.status;
  const code = result.code;

  if (code) {
    await maybeNotifyNumberCode(activationId, code, userId);
    return {
      status: "STATUS_OK" as const,
      code,
      demo: false as const,
      provider: "fivesim" as const,
      rawStatus: status,
    };
  }

  if (status === "CANCELED" || status === "TIMEOUT" || status === "BANNED") {
    return {
      status: "STATUS_CANCEL" as const,
      code: null as string | null,
      demo: false as const,
      provider: "fivesim" as const,
      rawStatus: status,
    };
  }

  return {
    status: "STATUS_WAIT_CODE" as const,
    code: null as string | null,
    demo: false as const,
    provider: "fivesim" as const,
    rawStatus: status,
  };
}

async function findServiceTx(externalRef: string, userId?: string) {
  const ref = externalRef.slice(0, 120);
  return db.query.transactions.findFirst({
    where: userId
      ? and(eq(transactions.externalRef, ref), eq(transactions.userId, userId))
      : eq(transactions.externalRef, ref),
  });
}

async function maybeNotifyNumberCode(
  activationId: string,
  code: string,
  userId?: string,
) {
  const tx = await findServiceTx(activationId, userId);
  if (!tx) return;
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  if (meta.completionNotifiedAt) return;

  await db
    .update(transactions)
    .set({
      metadata: {
        ...meta,
        completionNotifiedAt: new Date().toISOString(),
        smsCode: code,
      },
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  if (tx.relatedOrderId) {
    await db
      .update(userVirtualNumbers)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(userVirtualNumbers.id, tx.relatedOrderId));
  }

  const phone =
    typeof meta.phoneNumber === "string" ? meta.phoneNumber : "your number";
  await notifyServiceEvent({
    userId: tx.userId,
    title: "SMS code received",
    body: `Code for ${phone}: ${code}`,
    type: "virtual_number",
    href: "/services/virtual-numbers",
    metadata: { activationId, transactionId: tx.id, provider: "fivesim" },
  });

  try {
    await finishFivesimOrder(activationId);
  } catch {
    // non-fatal
  }
}

export async function cancelFivesimNumber(activationId: string) {
  if (!isFivesimLive()) {
    throw new Error("5sim is not configured for live cancellations");
  }
  return cancelFivesimOrder(activationId);
}
