/**
 * 5sim virtual-number purchase + status polling.
 */

import { and, eq, inArray, lte } from "drizzle-orm";
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
import { refundFailedDebit, reverseCompletedDebit } from "@/lib/wallet/ledger";
import { countryFlagEmoji } from "./flags";
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
  FIVESIM_EMAIL_SERVICES,
  FIVESIM_POPULAR_SERVICES,
  resolveFivesimProduct,
  type FivesimPriceOffer,
} from "./catalog";

const LOG_PREFIX = "[5sim-purchase]";
/** Wait this long for an SMS before reversing the purchase. */
export const VIRTUAL_NUMBER_SMS_TIMEOUT_MS = 60 * 60 * 1000;

async function usdRetailNumberPrice(
  usd: number,
  countryCode?: string | null,
  serviceKey?: string | null,
) {
  const { priceUsdToLocal } = await import("@/lib/pricing/service-pricing");
  const currency = currencyForCountry(countryCode);
  const quote = await quoteLocalUsd(currency);
  const priced = await priceUsdToLocal({
    provider: "herosms",
    serviceKey,
    usd,
    buyRate: quote.buyRate,
    source: "virtual_number",
  });
  return {
    usd: usdFromLocalRetail(priced.local, quote.buyRate),
    local: priced.local,
    currency: "USD" as const,
    localCurrency: currency,
    quote,
    markup: priced.markup,
    companyCharge: priced.companyCharge,
  };
}

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
    FIVESIM_POPULAR_SERVICES.find((s) => s.code === product)?.name ||
    FIVESIM_EMAIL_SERVICES.find((s) => s.code === product)?.name ||
    product;

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
  const { usd, local, quote } = await usdRetailNumberPrice(
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

    const expiresAt = new Date(Date.now() + VIRTUAL_NUMBER_SMS_TIMEOUT_MS);

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

    // Stay pending/processing until the SMS code arrives (or we time out).
    await db
      .update(transactions)
      .set({
        status: "processing",
        externalRef: bought.activationId,
        relatedOrderId: row.id,
        relatedOrderType: "virtual_number",
        updatedAt: new Date(),
        metadata: {
          provider: "fivesim",
          kind: "virtual_number",
          awaitingSms: true,
          activationId: bought.activationId,
          phoneNumber: bought.phoneNumber,
          service: product,
          countrySlug,
          operator: bought.operator,
          expiresAt: expiresAt.toISOString(),
          costUsd: wholesaleUsd,
          priceUsd: chargeAmount,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

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
      expiresAt: expiresAt.toISOString(),
      status: "pending" as const,
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

  const tx = await findServiceTx(activationId, userId);
  if (userId && !tx) {
    throw new Error("Number order not found");
  }

  const meta = (tx?.metadata || {}) as Record<string, unknown>;
  if (typeof meta.smsCode === "string" && meta.smsCode) {
    return {
      status: "STATUS_OK" as const,
      code: meta.smsCode,
      demo: false as const,
      provider: "fivesim" as const,
      rawStatus: "FINISHED",
      transactionStatus: "completed" as const,
    };
  }

  if (
    tx &&
    (tx.status === "reversed" ||
      tx.status === "failed" ||
      tx.status === "cancelled")
  ) {
    return {
      status: "STATUS_CANCEL" as const,
      code: null as string | null,
      demo: false as const,
      provider: "fivesim" as const,
      rawStatus: String(tx.status).toUpperCase(),
      transactionStatus: tx.status,
      refunded: true as const,
    };
  }

  // Auto-reverse if past the 1-hour SMS window.
  if (tx && isPastSmsDeadline(tx)) {
    await reverseVirtualNumberForTimeout({
      tx,
      activationId,
      reason: "No SMS code arrived within 1 hour. Purchase reversed.",
    });
    return {
      status: "STATUS_CANCEL" as const,
      code: null as string | null,
      demo: false as const,
      provider: "fivesim" as const,
      rawStatus: "TIMEOUT",
      transactionStatus: "reversed" as const,
      refunded: true as const,
    };
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
      transactionStatus: "completed" as const,
    };
  }

  if (status === "CANCELED" || status === "TIMEOUT" || status === "BANNED") {
    if (tx) {
      await reverseVirtualNumberForTimeout({
        tx,
        activationId,
        reason:
          status === "TIMEOUT"
            ? "Number timed out before an SMS arrived. Purchase reversed."
            : "Number was cancelled. Purchase reversed.",
      });
    }
    return {
      status: "STATUS_CANCEL" as const,
      code: null as string | null,
      demo: false as const,
      provider: "fivesim" as const,
      rawStatus: status,
      transactionStatus: "reversed" as const,
      refunded: true as const,
    };
  }

  return {
    status: "STATUS_WAIT_CODE" as const,
    code: null as string | null,
    demo: false as const,
    provider: "fivesim" as const,
    rawStatus: status,
    transactionStatus: "processing" as const,
    expiresAt:
      typeof meta.expiresAt === "string"
        ? meta.expiresAt
        : tx?.createdAt
          ? new Date(
              new Date(tx.createdAt).getTime() + VIRTUAL_NUMBER_SMS_TIMEOUT_MS,
            ).toISOString()
          : null,
  };
}

function isPastSmsDeadline(tx: {
  createdAt: Date | string;
  metadata: Record<string, unknown> | null;
}) {
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  if (typeof meta.expiresAt === "string") {
    const at = Date.parse(meta.expiresAt);
    if (Number.isFinite(at)) return Date.now() >= at;
  }
  const created = new Date(tx.createdAt).getTime();
  return Date.now() - created >= VIRTUAL_NUMBER_SMS_TIMEOUT_MS;
}

async function findServiceTx(externalRef: string, userId?: string) {
  const ref = externalRef.slice(0, 120);
  return db.query.transactions.findFirst({
    where: userId
      ? and(eq(transactions.externalRef, ref), eq(transactions.userId, userId))
      : eq(transactions.externalRef, ref),
  });
}

async function reverseVirtualNumberForTimeout(input: {
  tx: {
    id: string;
    userId: string;
    walletId: string;
    amount: string | number;
    status: string;
    relatedOrderId: string | null;
    metadata: Record<string, unknown> | null;
  };
  activationId: string;
  reason: string;
}) {
  const meta = (input.tx.metadata || {}) as Record<string, unknown>;
  if (
    meta.smsCode ||
    meta.refundedAt ||
    input.tx.status === "reversed" ||
    input.tx.status === "failed"
  ) {
    return { already: true as const };
  }

  try {
    if (isFivesimLive()) {
      await cancelFivesimOrder(input.activationId);
    }
  } catch (error) {
    console.error(LOG_PREFIX, "cancel on timeout failed", error);
  }

  await reverseCompletedDebit({
    walletId: input.tx.walletId,
    transactionId: input.tx.id,
    amount: Number(input.tx.amount),
    reason: input.reason,
    userId: input.tx.userId,
  });

  // reverseCompletedDebit marks reversed; keep awaitingSms cleared
  await db
    .update(transactions)
    .set({
      updatedAt: new Date(),
      metadata: {
        ...meta,
        awaitingSms: false,
        reversedForSmsTimeout: true,
        reverseReason: input.reason,
      },
    })
    .where(eq(transactions.id, input.tx.id));

  if (input.tx.relatedOrderId) {
    await db
      .update(userVirtualNumbers)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(userVirtualNumbers.id, input.tx.relatedOrderId));
  }

  await notifyServiceEvent({
    userId: input.tx.userId,
    title: "Number purchase reversed",
    body: input.reason,
    type: "virtual_number",
    href: `/history/${input.tx.id}`,
    metadata: {
      activationId: input.activationId,
      transactionId: input.tx.id,
      refunded: true,
    },
  });

  return { already: false as const };
}

async function maybeNotifyNumberCode(
  activationId: string,
  code: string,
  userId?: string,
) {
  const tx = await findServiceTx(activationId, userId);
  if (!tx) return;
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  if (meta.completionNotifiedAt && meta.smsCode) {
    // Already completed earlier
    if (tx.status !== "completed") {
      await db
        .update(transactions)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(transactions.id, tx.id));
    }
    return;
  }

  await db
    .update(transactions)
    .set({
      status: "completed",
      metadata: {
        ...meta,
        awaitingSms: false,
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

  // Recognize profit only once the SMS is delivered.
  try {
    const wholesaleUsd = Number(meta.costUsd) || 0;
    const customerUsd = Number(meta.priceUsd) || Number(tx.amount) || 0;
    if (customerUsd > 0) {
      const { recognizeUsdServiceProfit } = await import(
        "@/lib/company/recognize"
      );
      await recognizeUsdServiceProfit({
        source: "virtual_number",
        transactionId: tx.id,
        userId: tx.userId,
        customerUsd,
        providerUsd: wholesaleUsd > 0 ? wholesaleUsd : customerUsd,
        description: "Virtual number SMS received",
        metadata: {
          provider: "fivesim",
          activationId,
          service: meta.service,
        },
      });
    }
  } catch (revenueError) {
    console.error("[5sim-revenue]", revenueError);
  }

  const phone =
    typeof meta.phoneNumber === "string" ? meta.phoneNumber : "your number";
  await notifyServiceEvent({
    userId: tx.userId,
    title: "SMS code received",
    body: `Code for ${phone}: ${code}`,
    type: "virtual_number",
    href: `/history/${tx.id}`,
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

/**
 * Reverse number purchases that stayed pending past the SMS timeout.
 * Called from the settle-pending cron.
 */
export async function expireStaleVirtualNumberPurchases(limit = 40) {
  const cutoff = new Date(Date.now() - VIRTUAL_NUMBER_SMS_TIMEOUT_MS);
  const stale = await db.query.transactions.findMany({
    where: and(
      eq(transactions.category, "virtual_number"),
      eq(transactions.type, "debit"),
      inArray(transactions.status, ["pending", "processing"]),
      lte(transactions.createdAt, cutoff),
    ),
    limit,
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const results: Array<{ id: string; action: string }> = [];
  for (const row of stale) {
    const meta = (row.metadata || {}) as Record<string, unknown>;
    if (meta.smsCode) {
      await db
        .update(transactions)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(transactions.id, row.id));
      results.push({ id: row.id, action: "completed" });
      continue;
    }
    const activationId = String(
      meta.activationId || row.externalRef || "",
    ).trim();
    if (!activationId) {
      results.push({ id: row.id, action: "missing_activation" });
      continue;
    }
    try {
      // Prefer live check first — code may have arrived without client poll.
      if (isFivesimLive()) {
        const check = await checkFivesimOrder(activationId);
        if (check.code) {
          await maybeNotifyNumberCode(activationId, check.code, row.userId);
          results.push({ id: row.id, action: "completed_late" });
          continue;
        }
      }
      await reverseVirtualNumberForTimeout({
        tx: row,
        activationId,
        reason: "No SMS code arrived within 1 hour. Purchase reversed.",
      });
      results.push({ id: row.id, action: "reversed" });
    } catch (error) {
      console.error(LOG_PREFIX, "expire stale failed", row.id, error);
      results.push({ id: row.id, action: "error" });
    }
  }

  return { scanned: stale.length, results };
}
