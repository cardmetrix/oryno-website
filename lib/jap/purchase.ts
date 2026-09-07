import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  socialOrders,
  socialPackages,
  transactions,
  wallets,
} from "@/lib/db/schema";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { resolveCountryCode } from "@/lib/country";
import { usdFromLocalRetail } from "@/lib/pricing/service-pricing";
import { debitUsdWallet } from "@/lib/wallet-usd";
import {
  currencyForCountry,
  toWalletSummary,
} from "@/lib/wallet";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  addJapOrder,
  assertJapReady,
  getJapOrderStatus,
  getJapServices,
  isJapDemoMode,
  isJapLive,
} from "./client";
import {
  FALLBACK_JAP_SERVICES,
  isCustomCommentsService,
  japUsdCost,
  normalizeCustomComments,
} from "./catalog";
import { japErrorToEnglish } from "./errors";

const LOG_PREFIX = "[jap]";

async function refundDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
}) {
  await refundFailedDebit(input);
}

export async function usdToLocalJapPrice(
  usd: number,
  countryCode?: string | null,
  serviceKey?: string | null,
) {
  const currency = currencyForCountry(countryCode);
  const quote = await quoteLocalUsd(currency);
  const { priceUsdToLocal } = await import("@/lib/pricing/service-pricing");
  const priced = await priceUsdToLocal({
    provider: "jap",
    serviceKey,
    usd,
    buyRate: quote.buyRate,
    source: "social",
  });
  return {
    local: priced.local,
    currency,
    quote,
    markup: priced.markup,
    companyCharge: priced.companyCharge,
  };
}

/** Retail USD for boosting — local retail (markup + app buyRate) converted back at that rate. */
export async function usdRetailJapPrice(
  usd: number,
  countryCode?: string | null,
  serviceKey?: string | null,
) {
  const priced = await usdToLocalJapPrice(usd, countryCode, serviceKey);
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

async function ensureSocialPackage(input: {
  countryCode: string;
  platform: string;
  name: string;
  metric: string;
  quantity: number;
  price: number;
}) {
  const country = input.countryCode.slice(0, 2).toUpperCase() || "NG";
  const qtyLabel = String(input.quantity);
  // Encode JAP service identity in name prefix for stable upsert
  const packageName = input.name.slice(0, 120);

  const existing = await db.query.socialPackages.findFirst({
    where: and(
      eq(socialPackages.countryCode, country),
      eq(socialPackages.platform, input.platform.slice(0, 40)),
      eq(socialPackages.name, packageName),
      eq(socialPackages.quantity, qtyLabel),
    ),
  });
  if (existing) {
    await db
      .update(socialPackages)
      .set({
        price: input.price.toFixed(2),
        active: true,
        updatedAt: new Date(),
      })
      .where(eq(socialPackages.id, existing.id));
    return existing;
  }

  const [created] = await db
    .insert(socialPackages)
    .values({
      countryCode: country,
      platform: input.platform.slice(0, 40),
      name: packageName,
      metric: input.metric.slice(0, 40),
      quantity: qtyLabel.slice(0, 40),
      price: input.price.toFixed(2),
      delivery: "Starts after order",
      popular: false,
      active: true,
    })
    .returning();

  return created;
}

export async function purchaseJapBoost(input: {
  userId: string;
  countryCode?: string | null;
  serviceId: number;
  serviceName: string;
  platform: string;
  metric: string;
  link: string;
  quantity: number;
  rateUsd: number;
  priceLocal?: number;
  comments?: string | string[];
}) {
  const link = input.link.trim();
  if (link.length < 4) throw new Error("Enter a valid profile or post link");

  let providerService:
    | { service: number; type: string; name: string; min: number; max: number }
    | undefined;
  try {
    const live = isJapDemoMode()
      ? FALLBACK_JAP_SERVICES
      : await getJapServices();
    providerService = live.find((s) => s.service === input.serviceId);
  } catch {
    providerService = FALLBACK_JAP_SERVICES.find(
      (s) => s.service === input.serviceId,
    );
  }

  const needsComments = isCustomCommentsService(
    providerService ?? {
      type: "",
      name: input.serviceName,
    },
  );

  const comments = normalizeCustomComments(input.comments);
  let quantity = Number(input.quantity);

  if (needsComments) {
    if (!comments.length) {
      throw new Error("Add at least one custom comment");
    }
    quantity = comments.length;
    const min = Math.max(1, providerService?.min || 1);
    const max = Math.max(min, providerService?.max || 1_000_000);
    if (quantity < min) {
      throw new Error(`Add at least ${min.toLocaleString()} custom comments`);
    }
    if (quantity > max) {
      throw new Error(
        `You can add at most ${max.toLocaleString()} custom comments`,
      );
    }
  } else if (comments.length) {
    throw new Error("This package does not accept custom comments");
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Enter a valid quantity");
  }

  const commentsPayload = needsComments ? comments.join("\n") : undefined;

  const wholesaleUsd = japUsdCost(input.rateUsd, quantity);
  const { usd, local, quote, companyCharge } = await usdRetailJapPrice(
    wholesaleUsd,
    input.countryCode,
    String(input.serviceId),
  );
  // Always charge admin/server retail USD — ignore client-posted amounts.
  const chargeAmount = usd;
  const currency = "USD";

  const pkg = await ensureSocialPackage({
    countryCode: resolveCountryCode(input.countryCode),
    platform: input.platform,
    name: input.serviceName,
    metric: input.metric,
    quantity,
    price: chargeAmount,
  });

  console.log(LOG_PREFIX, "purchase start", {
    live: isJapLive(),
    serviceId: input.serviceId,
    platform: input.platform,
    metric: input.metric,
    quantity,
    needsComments,
    commentsCount: comments.length,
    wholesaleUsd,
    chargeAmount,
    currency,
    buyRate: quote.buyRate,
  });

  // Fail before debiting wallet when live provider is down / empty
  if (!isJapDemoMode()) {
    await assertJapReady(Math.max(0.01, wholesaleUsd * 0.5));
  }

  const debit = await debitUsdWallet({
    userId: input.userId,
    amount: chargeAmount,
    category: "social",
    title: "Social boost",
    subtitle: `${quantity.toLocaleString()} ${input.metric} · ${input.platform}`,
    metadata: {
      provider: "jap",
      kind: "social_boost",
      japServiceId: input.serviceId,
      quantity,
      link,
      costUsd: wholesaleUsd,
      priceUsd: chargeAmount,
      priceLocal: local,
      buyRate: quote.buyRate,
      ...(needsComments ? { customComments: true, commentsCount: comments.length } : {}),
    },
  });

  try {
    let orderId: string;
    let simulated = false;

    if (isJapDemoMode()) {
      throw new Error(
        "JustAnotherPanel is not configured for live purchases. Set JAP_API_KEY and JAP_DEMO=false.",
      );
    }
    const placed = await addJapOrder({
      service: input.serviceId,
      link,
      ...(needsComments
        ? { comments: commentsPayload }
        : { quantity }),
    });
    orderId = placed.orderId;
    console.log(LOG_PREFIX, "purchase LIVE", { orderId });

    const [order] = await db
      .insert(socialOrders)
      .values({
        userId: input.userId,
        packageId: pkg.id,
        profileUrl: link.slice(0, 2000),
        amount: chargeAmount.toFixed(2),
        status: "processing",
        deliveryEta: "Starts after order",
        transactionId: debit.transaction.id,
        providerRef: orderId.slice(0, 120),
      })
      .returning();

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: orderId,
        relatedOrderId: order?.id,
        relatedOrderType: "social_order",
        updatedAt: new Date(),
        metadata: {
          provider: "jap",
          kind: "social_boost",
          japOrderId: orderId,
          japServiceId: input.serviceId,
          quantity,
          link,
          simulated,
          ...(needsComments
            ? { customComments: true, commentsCount: comments.length }
            : {}),
        },
      })
      .where(eq(transactions.id, debit.transaction.id));

    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);

    try {
      const { recognizeUsdServiceProfit } = await import("@/lib/company/recognize");
      await recognizeUsdServiceProfit({
        source: "social",
        transactionId: debit.transaction.id,
        userId: input.userId,
        customerUsd: chargeAmount,
        providerUsd: wholesaleUsd,
        chargeUsd: Math.max(
          0,
          quote.buyRate > 0 ? companyCharge / quote.buyRate : 0,
        ),
        description: `Social boost ${input.platform}`,
        metadata: {
          japServiceId: input.serviceId,
          quantity,
        },
      });
    } catch (revenueError) {
      console.error("[jap-revenue]", revenueError);
    }

    return {
      simulated,
      orderId,
      socialOrderId: order?.id,
      transactionId: debit.transaction.id,
      amount: chargeAmount,
      currency,
      wallet: toWalletSummary(debit.wallet),
      package: pkg,
    };
  } catch (error) {
    const reason = japErrorToEnglish(
      error instanceof Error ? error.message : "Purchase failed",
    );
    console.error(LOG_PREFIX, "purchase failed — refunding", reason);
    await refundDebit({
      walletId: debit.wallet.id,
      transactionId: debit.transaction.id,
      amount: chargeAmount,
      reason,
    });
    throw new Error(reason);
  }
}

export async function pollJapOrderStatus(orderId: string) {
  if (orderId.startsWith("demo_") || isJapDemoMode()) {
    console.log(LOG_PREFIX, "poll DEMO", { orderId });
    return {
      status: "In progress",
      start_count: "0",
      remains: "0",
      charge: "0",
      currency: "USD",
    };
  }
  console.log(LOG_PREFIX, "poll LIVE", { orderId });
  return getJapOrderStatus(orderId);
}
