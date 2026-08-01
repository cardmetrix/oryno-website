import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  socialOrders,
  socialPackages,
  transactions,
  wallets,
} from "@/lib/db/schema";
import { quoteLocalUsd, roundMoney } from "@/lib/fx/rates";
import { resolveCountryCode } from "@/lib/country";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import {
  addJapOrder,
  assertJapReady,
  getJapOrderStatus,
  isJapDemoMode,
  isJapLive,
  japMarkup,
} from "./client";
import { japUsdCost } from "./catalog";
import { japErrorToEnglish } from "./errors";

const LOG_PREFIX = "[jap]";

async function debitWallet(input: {
  userId: string;
  countryCode?: string | null;
  amount: number;
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const currency = currencyForCountry(input.countryCode);
  const wallet = await ensurePrimaryWallet(input.userId, currency);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("Wallet is not available for payments");
  }

  const amountStr = input.amount.toFixed(2);

  return db.transaction(async (tx) => {
    const current = await tx.query.wallets.findFirst({
      where: eq(wallets.id, wallet.id),
    });
    if (!current) throw new Error("Wallet not found");
    if (Number(current.balance) < input.amount) {
      throw new Error("Insufficient wallet balance");
    }

    const next = (Number(current.balance) - input.amount).toFixed(2);
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
        category: "social",
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency,
        status: "processing",
        balanceAfter: next,
        metadata: {
          provider: "jap",
          ...(input.metadata ?? {}),
        },
      })
      .returning();

    return {
      wallet: updated ?? { ...current, balance: next },
      transaction: txRow,
      amount: input.amount,
      currency,
    };
  });
}

async function refundDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
}) {
  await db.transaction(async (tx) => {
    const wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, input.walletId),
    });
    if (wallet) {
      const restored = (Number(wallet.balance) + input.amount).toFixed(2);
      await tx
        .update(wallets)
        .set({ balance: restored, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));
    }
    await tx
      .update(transactions)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: { failureReason: input.reason },
      })
      .where(eq(transactions.id, input.transactionId));
  });
}

export async function usdToLocalJapPrice(
  usd: number,
  countryCode?: string | null,
) {
  const currency = currencyForCountry(countryCode);
  const quote = await quoteLocalUsd(currency);
  const local = roundMoney(usd * quote.buyRate * japMarkup());
  return { local, currency, quote };
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
}) {
  const link = input.link.trim();
  if (link.length < 4) throw new Error("Enter a valid profile or post link");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    throw new Error("Enter a valid quantity");
  }

  const priceUsd = japUsdCost(input.rateUsd, input.quantity);
  const { local, currency } = await usdToLocalJapPrice(
    priceUsd,
    input.countryCode,
  );
  const chargeAmount =
    Number.isFinite(input.priceLocal) && (input.priceLocal as number) > 0
      ? roundMoney(input.priceLocal as number)
      : local;

  const pkg = await ensureSocialPackage({
    countryCode: resolveCountryCode(input.countryCode),
    platform: input.platform,
    name: input.serviceName,
    metric: input.metric,
    quantity: input.quantity,
    price: chargeAmount,
  });

  console.log(LOG_PREFIX, "purchase start", {
    live: isJapLive(),
    serviceId: input.serviceId,
    platform: input.platform,
    metric: input.metric,
    quantity: input.quantity,
    priceUsd,
    chargeAmount,
    currency,
  });

  // Fail before debiting wallet when live provider is down / empty
  if (!isJapDemoMode()) {
    await assertJapReady(Math.max(0.01, priceUsd * 0.5));
  }

  const debit = await debitWallet({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: chargeAmount,
    title: "Social boost",
    subtitle: `${input.quantity.toLocaleString()} ${input.metric} · ${input.platform}`,
    metadata: {
      kind: "social_boost",
      japServiceId: input.serviceId,
      quantity: input.quantity,
      link,
      priceUsd,
    },
  });

  try {
    let orderId: string;
    let simulated = false;

    if (isJapDemoMode()) {
      simulated = true;
      orderId = `demo_jap_${Date.now()}`;
      console.log(LOG_PREFIX, "purchase DEMO", { orderId });
    } else {
      const placed = await addJapOrder({
        service: input.serviceId,
        link,
        quantity: input.quantity,
      });
      orderId = placed.orderId;
      console.log(LOG_PREFIX, "purchase LIVE", { orderId });
    }

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
          quantity: input.quantity,
          link,
          simulated,
        },
      })
      .where(eq(transactions.id, debit.transaction.id));

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
