import { createHash, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  giftCardBrands,
  giftCardOrders,
  transactions,
  wallets,
} from "@/lib/db/schema";
import { nigeriaServiceLedgerCurrency, getDisplayFx } from "@/lib/display-currency";
import { convertNgnToLocal, quoteLocalUsd, roundMoney } from "@/lib/fx/rates";
import { ensurePrimaryWallet, toWalletSummary } from "@/lib/wallet";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import { categoryForSlug } from "@/lib/sogo/catalog";
import {
  assertReloadlyReady,
  fetchReloadlyCards,
  fetchReloadlyProduct,
  fetchReloadlyProducts,
  isReloadlyDemoMode,
  placeReloadlyOrder,
} from "./client";
import type { BuyProductView } from "./types";

function localReference() {
  return `GB${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`.slice(0, 32);
}

async function ensureBrand(name: string, slugHint?: string) {
  const slug = (slugHint || name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const existing = await db.query.giftCardBrands.findFirst({
    where: eq(giftCardBrands.slug, slug),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(giftCardBrands)
    .values({
      name: name.slice(0, 80),
      slug,
      category: categoryForSlug(slug, name).slice(0, 80),
      status: "live",
    })
    .returning();

  if (created) return created;

  const again = await db.query.giftCardBrands.findFirst({
    where: eq(giftCardBrands.slug, slug),
  });
  if (!again) throw new Error("Unable to resolve gift card brand");
  return again;
}

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

  const currency = nigeriaServiceLedgerCurrency();
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
        category: "gift_card",
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency,
        status: "processing",
        balanceAfter: next,
        metadata: {
          provider: "reloadly",
          side: "buy",
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
  await refundFailedDebit(input);
}

export async function quoteGiftCardBuy(input: {
  product: BuyProductView;
  unitPrice: number;
  countryCode?: string | null;
}) {
  const key = String(input.unitPrice);
  const mappedUsd = input.product.senderPriceMap[key];
  const usdFace =
    Number.isFinite(mappedUsd) && mappedUsd > 0
      ? mappedUsd
      : input.unitPrice;

  // Ledger is always NGN; display converts to the account country.
  const quote = await quoteLocalUsd(nigeriaServiceLedgerCurrency());
  const { priceUsdToLocal } = await import("@/lib/pricing/service-pricing");
  const priced = await priceUsdToLocal({
    provider: "reloadly",
    serviceKey: String(input.product.productId),
    usd: usdFace,
    buyRate: quote.buyRate,
    source: "gift_card_buy",
  });
  const displayFx = await getDisplayFx(input.countryCode);

  return {
    usdFace,
    local: convertNgnToLocal(priced.local, displayFx.ngnToLocal),
    currency: displayFx.to,
    ledgerNgn: priced.local,
    rate: quote.buyRate,
    midRate: quote.midRate,
    markup: priced.markup,
    companyCharge: priced.companyCharge,
    demo: isReloadlyDemoMode(),
  };
}

export async function buyGiftCard(input: {
  userId: string;
  countryCode?: string | null;
  email: string;
  displayName?: string | null;
  productId: number;
  unitPrice: number;
  quantity?: number;
}) {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email to receive the gift card");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    throw new Error("Select a valid card amount");
  }

  let product = await fetchReloadlyProduct(input.productId);
  if (!product) {
    const catalog = await fetchReloadlyProducts({});
    product =
      catalog.find((p) => p.productId === input.productId) ?? null;
  }
  if (!product) throw new Error("Gift card product not found");

  const amount = Number(input.unitPrice);
  const denomType = (product.denominationType || "FIXED").toUpperCase();
  if (denomType === "FIXED" && product.denominations.length) {
    const matches = product.denominations.some(
      (d) => Math.abs(Number(d) - amount) < 0.001,
    );
    if (!matches) {
      throw new Error("That amount isn’t available for this card");
    }
  } else {
    if (
      product.minAmount != null &&
      input.unitPrice < product.minAmount
    ) {
      throw new Error(`Minimum amount is ${product.minAmount}`);
    }
    if (
      product.maxAmount != null &&
      input.unitPrice > product.maxAmount
    ) {
      throw new Error(`Maximum amount is ${product.maxAmount}`);
    }
  }

  const price = await quoteGiftCardBuy({
    product,
    unitPrice: input.unitPrice,
    countryCode: input.countryCode,
  });

  // Fail fast on provider auth/balance before debiting the user wallet
  await assertReloadlyReady(0.01);

  const brand = await ensureBrand(product.brandName, product.brandName);
  const customIdentifier = `oryno-${randomUUID()}`;
  const reference = localReference();

  const debit = await debitWallet({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: price.ledgerNgn,
    title: `Bought ${product.brandName} gift card`,
    subtitle: `${product.recipientCurrency} ${input.unitPrice} · ${product.name}`,
    metadata: {
      productId: product.productId,
      unitPrice: input.unitPrice,
      customIdentifier,
      orderReference: reference,
    },
  });

  const [order] = await db
    .insert(giftCardOrders)
    .values({
      reference,
      userId: input.userId,
      brandId: brand.id,
      side: "buy",
      amountUsd: input.unitPrice.toFixed(2),
      localAmount: price.ledgerNgn.toFixed(2),
      currency: debit.currency,
      cardImageUrl: product.image,
      cardCodeEncrypted: null,
      status: "processing",
      transactionId: debit.transaction.id,
    })
    .returning();

  try {
    const { order: providerOrder, simulated } = await placeReloadlyOrder({
      productId: product.productId,
      unitPrice: input.unitPrice,
      quantity: input.quantity || 1,
      customIdentifier,
      senderName: (input.displayName || "ORYNO").slice(0, 80),
      recipientEmail: email,
    });

    const cards = await fetchReloadlyCards(providerOrder.transactionId);
    const codePayload = cards.map((c) => ({
      cardNumber: c.cardNumber != null ? String(c.cardNumber) : null,
      pinCode: c.pinCode ?? null,
    }));
    const codeHash = createHash("sha256")
      .update(JSON.stringify(codePayload))
      .digest("hex");

    const ok =
      /success/i.test(providerOrder.status || "") ||
      providerOrder.status === "PENDING" ||
      simulated;

    if (!ok) {
      throw new Error(
        `Purchase ${providerOrder.status || "failed"}. Please try again.`,
      );
    }

    await db
      .update(giftCardOrders)
      .set({
        status: "completed",
        cardCodeEncrypted: JSON.stringify({
          hash: codeHash,
          cards: codePayload,
        }),
        updatedAt: new Date(),
      })
      .where(eq(giftCardOrders.id, order.id));

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: String(providerOrder.transactionId),
        updatedAt: new Date(),
        metadata: {
          provider: "reloadly",
          side: "buy",
          orderId: order.id,
          orderReference: reference,
          productId: product.productId,
          unitPrice: input.unitPrice,
          customIdentifier,
          reloadlyTransactionId: providerOrder.transactionId,
          reloadlyStatus: providerOrder.status,
          recipientEmail: email,
          cards: codePayload,
          demo: simulated,
        },
      })
      .where(eq(transactions.id, debit.transaction.id));

    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);

    try {
      const { ngnValueOfUsd, recognizeNgnServiceProfit } = await import(
        "@/lib/company/recognize"
      );
      const providerNgn = await ngnValueOfUsd(price.usdFace);
      await recognizeNgnServiceProfit({
        source: "gift_card_buy",
        transactionId: debit.transaction.id,
        userId: input.userId,
        grossIn: debit.amount,
        grossOut: providerNgn,
        chargeAmount: price.companyCharge,
        markupAmount: Math.max(0, debit.amount - providerNgn - price.companyCharge),
        fxSpreadAmount: Math.max(
          0,
          roundMoney(price.usdFace * price.rate) -
            roundMoney(price.usdFace * price.midRate),
        ),
        description: `Bought ${product.brandName} gift card`,
        metadata: {
          productId: product.productId,
          usdFace: price.usdFace,
          buyRate: price.rate,
          midRate: price.midRate,
        },
      });
    } catch (revenueError) {
      console.error("[reloadly-revenue]", revenueError);
    }

    return {
      order,
      transactionId: debit.transaction.id,
      reference,
      providerTransactionId: providerOrder.transactionId,
      amount: debit.amount,
      currency: debit.currency,
      wallet: toWalletSummary(debit.wallet, await getDisplayFx(input.countryCode)),
      cards: codePayload,
      product,
      simulated,
      message: "Gift card purchased successfully",
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Failed to buy gift card";
    await refundDebit({
      walletId: debit.wallet.id,
      transactionId: debit.transaction.id,
      amount: debit.amount,
      reason,
    });
    await db
      .update(giftCardOrders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(giftCardOrders.id, order.id));
    throw new Error(reason);
  }
}
