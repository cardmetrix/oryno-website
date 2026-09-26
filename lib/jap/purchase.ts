import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  socialOrders,
  socialPackages,
  transactions,
} from "@/lib/db/schema";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { resolveCountryCode } from "@/lib/country";
import { roundMoney } from "@/lib/fx/rates";
import {
  getProviderMarkup,
  usdFromLocalRetail,
} from "@/lib/pricing/service-pricing";
import { debitUsdWallet } from "@/lib/wallet-usd";
import {
  currencyForCountry,
  toWalletSummary,
} from "@/lib/wallet";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  addJapOrder,
  getJapOrderStatus,
  getJapServiceById,
  isJapDemoMode,
} from "./client";
import {
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
  /** Ignored for pricing — server uses live catalog rate. */
  rateUsd?: number;
  priceLocal?: number;
  comments?: string | string[];
}) {
  const started = Date.now();
  const step = (name: string, extra?: Record<string, unknown>) => {
    console.log("[boost]", name, { ms: Date.now() - started, ...extra });
  };

  const link = input.link.trim();
  step("purchase start", {
    serviceId: input.serviceId,
    quantity: input.quantity,
    platform: input.platform,
  });
  if (link.length < 4) throw new Error("Enter a valid profile or post link");

  if (isJapDemoMode()) {
    throw new Error(
      "Social boosting is not configured for live purchases.",
    );
  }

  let providerService: Awaited<ReturnType<typeof getJapServiceById>>;
  try {
    step("loading service");
    providerService = await getJapServiceById(input.serviceId);
    step("service ready", { found: Boolean(providerService) });
  } catch (error) {
    console.error("[boost] service lookup failed", error);
    throw new Error(
      "Could not load boost catalog from the provider. Try again in a moment.",
    );
  }

  if (!providerService || !(providerService.rate > 0)) {
    throw new Error("That boost package is no longer available. Pick another.");
  }

  const serviceName = providerService.name || input.serviceName;
  const needsComments = isCustomCommentsService(providerService);
  const comments = normalizeCustomComments(input.comments);
  let quantity = Number(input.quantity);
  const min = Math.max(1, providerService.min || 1);
  const max = Math.max(min, providerService.max || 1_000_000);

  if (needsComments) {
    if (!comments.length) {
      throw new Error("Add at least one custom comment");
    }
    quantity = comments.length;
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
  } else {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Enter a valid quantity");
    }
    if (quantity < min) {
      throw new Error(`Minimum quantity is ${min.toLocaleString()}`);
    }
    if (quantity > max) {
      throw new Error(`Maximum quantity is ${max.toLocaleString()}`);
    }
  }

  const commentsPayload = needsComments ? comments.join("\n") : undefined;

  // Always price from provider catalog rate — never trust client rateUsd.
  const wholesaleUsd = japUsdCost(providerService.rate, quantity);
  step("pricing", { wholesaleUsd, providerRateUsd: providerService.rate });

  const currencyCode = currencyForCountry(input.countryCode);
  const [quote, markup] = await Promise.all([
    quoteLocalUsd(currencyCode),
    getProviderMarkup("jap"),
  ]);
  const localRetail = roundMoney(
    wholesaleUsd * quote.buyRate * markup,
  );
  const chargeAmount = usdFromLocalRetail(localRetail, quote.buyRate);
  const currency = "USD";

  step("price ready", {
    chargeAmount,
    currency,
    buyRate: quote.buyRate,
    markup,
  });

  step("debiting usd wallet", { chargeAmount });
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
      priceLocal: localRetail,
      buyRate: quote.buyRate,
      ...(needsComments
        ? { customComments: true, commentsCount: comments.length }
        : {}),
    },
  });

  step("wallet debited", { transactionId: debit.transaction.id });

  try {
    step("placing provider order");
    const placed = await addJapOrder({
      service: input.serviceId,
      link,
      ...(needsComments ? { comments: commentsPayload } : { quantity }),
    });
    const orderId = placed.orderId;
    step("provider order ok", { orderId });

    const pkg = await ensureSocialPackage({
      countryCode: resolveCountryCode(input.countryCode),
      platform: input.platform,
      name: serviceName,
      metric: input.metric,
      quantity,
      price: chargeAmount,
    });

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
        status: "processing",
        externalRef: orderId,
        relatedOrderId: order?.id,
        relatedOrderType: "social_order",
        updatedAt: new Date(),
        metadata: {
          provider: "jap",
          kind: "social_boost",
          chargedFrom: "usd_wallet",
          japOrderId: orderId,
          japServiceId: input.serviceId,
          japStatus: "Pending",
          orderStatus: "processing",
          quantity,
          link,
          simulated: false,
          ...(needsComments
            ? { customComments: true, commentsCount: comments.length }
            : {}),
        },
      })
      .where(eq(transactions.id, debit.transaction.id));

    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);

    void import("@/lib/company/recognize")
      .then(({ recognizeUsdServiceProfit }) =>
        recognizeUsdServiceProfit({
          source: "social",
          transactionId: debit.transaction.id,
          userId: input.userId,
          customerUsd: chargeAmount,
          providerUsd: wholesaleUsd,
          chargeUsd: 0,
          description: `Social boost ${input.platform}`,
          metadata: {
            japServiceId: input.serviceId,
            quantity,
          },
        }),
      )
      .catch((revenueError) => {
        console.error("[jap-revenue]", revenueError);
      });

    return {
      simulated: false,
      orderId,
      socialOrderId: order?.id,
      transactionId: debit.transaction.id,
      amount: chargeAmount,
      currency,
      wallet: toWalletSummary(debit.wallet),
      package: pkg,
      quantity,
      metric: input.metric,
      platform: input.platform,
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

function mapJapStatusToOrder(
  raw: string,
): "processing" | "completed" | "failed" | "cancelled" {
  const s = raw.toLowerCase().trim();
  if (/cancel|refund/.test(s)) return "cancelled";
  if (/fail|error|reject/.test(s)) return "failed";
  if (/partial|in progress|processing|pending|queue|started/.test(s)) {
    return "processing";
  }
  if (/complet|done|success|finish/.test(s)) return "completed";
  return "processing";
}

async function syncBoostTransactionStatus(input: {
  transactionId: string;
  rawStatus: string;
  orderStatus: "processing" | "completed" | "failed" | "cancelled";
  userId: string;
}) {
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, input.transactionId),
  });
  if (!tx) return;

  const meta = (tx.metadata || {}) as Record<string, unknown>;
  const txStatus =
    input.orderStatus === "completed"
      ? "completed"
      : input.orderStatus === "failed" || input.orderStatus === "cancelled"
        ? "failed"
        : "processing";

  await db
    .update(transactions)
    .set({
      status: txStatus,
      metadata: {
        ...meta,
        japStatus: input.rawStatus,
        orderStatus: input.orderStatus,
        chargedFrom: meta.chargedFrom ?? "usd_wallet",
      },
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  if (
    (input.orderStatus === "failed" || input.orderStatus === "cancelled") &&
    (tx.status === "processing" || tx.status === "pending")
  ) {
    try {
      await refundDebit({
        walletId: tx.walletId,
        transactionId: tx.id,
        amount: Number(tx.amount),
        reason: `Boost ${input.rawStatus}`,
      });
    } catch (error) {
      console.error("[boost] refund after provider failure", error);
    }
  }
}

export async function pollJapOrderStatus(orderId: string, userId?: string) {
  if (orderId.startsWith("demo_") || isJapDemoMode()) {
    console.log(LOG_PREFIX, "poll DEMO", { orderId });
    return {
      status: "In progress",
      start_count: "0",
      remains: "0",
      charge: "0",
      currency: "USD",
      orderStatus: "processing" as const,
    };
  }

  const ref = orderId.slice(0, 120);
  const owned = userId
    ? await db.query.socialOrders.findFirst({
        where: and(
          eq(socialOrders.providerRef, ref),
          eq(socialOrders.userId, userId),
        ),
      })
    : await db.query.socialOrders.findFirst({
        where: eq(socialOrders.providerRef, ref),
      });

  if (userId && !owned) {
    throw new Error("Order not found");
  }

  console.log(LOG_PREFIX, "poll LIVE", { orderId });
  const data = await getJapOrderStatus(orderId);
  const rawStatus = String(data.status || "In progress");
  const orderStatus = mapJapStatusToOrder(rawStatus);

  if (owned && owned.status !== orderStatus) {
    await db
      .update(socialOrders)
      .set({
        status: orderStatus,
        failureReason:
          orderStatus === "failed" || orderStatus === "cancelled"
            ? rawStatus.slice(0, 500)
            : null,
        updatedAt: new Date(),
      })
      .where(eq(socialOrders.id, owned.id));
  }

  if (owned?.transactionId) {
    await syncBoostTransactionStatus({
      transactionId: owned.transactionId,
      rawStatus,
      orderStatus,
      userId: userId || owned.userId,
    });
  }

  if (
    owned &&
    (orderStatus === "completed" ||
      orderStatus === "failed" ||
      orderStatus === "cancelled")
  ) {
    await maybeNotifyBoostStatus({
      order: owned,
      orderId: ref,
      rawStatus,
      orderStatus,
      userId: userId || owned.userId,
    });
  }

  return {
    ...data,
    status: rawStatus,
    orderStatus,
  };
}

async function maybeNotifyBoostStatus(input: {
  order: { id: string; transactionId: string | null; userId: string };
  orderId: string;
  rawStatus: string;
  orderStatus: "completed" | "failed" | "cancelled" | "processing";
  userId: string;
}) {
  if (!input.order.transactionId) return;
  const tx = await db.query.transactions.findFirst({
    where: eq(transactions.id, input.order.transactionId),
  });
  if (!tx) return;
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  if (meta.statusNotifiedAt) return;

  await db
    .update(transactions)
    .set({
      metadata: {
        ...meta,
        statusNotifiedAt: new Date().toISOString(),
        japStatus: input.rawStatus,
        orderStatus: input.orderStatus,
      },
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  const { notifyServiceEvent } = await import("@/lib/notify/service-events");
  const done = input.orderStatus === "completed";
  await notifyServiceEvent({
    userId: input.userId,
    title: done ? "Boost completed" : "Boost update",
    body: done
      ? "Your social boost finished successfully."
      : `Your boost status is now: ${input.rawStatus}`,
    type: "social",
    href: `/history/${tx.id}`,
    metadata: {
      orderId: input.orderId,
      transactionId: tx.id,
      status: input.rawStatus,
    },
  });
}
