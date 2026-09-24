import { createHash, randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  giftCardBrands,
  giftCardOrders,
  transactions,
} from "@/lib/db/schema";
import { roundMoney } from "@/lib/fx/rates";
import { formatMoney } from "@/lib/transactions";
import { debitUsdWallet, ensureUsdWallet } from "@/lib/wallet-usd";
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

async function refundDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
}) {
  await refundFailedDebit(input);
}

/** Reloadly map keys may be "10", "10.0", or "10.00". */
function lookupSenderUsd(
  map: Record<string, number> | undefined,
  unitPrice: number,
): number | null {
  if (!map) return null;
  const direct = map[String(unitPrice)];
  if (Number.isFinite(direct) && direct > 0) return direct;
  const rounded = map[unitPrice.toFixed(2)];
  if (Number.isFinite(rounded) && rounded > 0) return rounded;
  const match = Object.entries(map).find(
    ([k, v]) => Math.abs(Number(k) - unitPrice) < 0.001 && Number(v) > 0,
  );
  return match ? Number(match[1]) : null;
}

export async function quoteGiftCardBuy(input: {
  product: BuyProductView;
  unitPrice: number;
  countryCode?: string | null;
}) {
  void input.countryCode;
  const mappedUsd = lookupSenderUsd(
    input.product.senderPriceMap,
    input.unitPrice,
  );
  let usdFace: number;
  if (mappedUsd != null) {
    usdFace = mappedUsd;
  } else if (
    (input.product.recipientCurrency || "").toUpperCase() === "USD"
  ) {
    usdFace = input.unitPrice;
  } else {
    const { getUsdMidRate } = await import("@/lib/fx/rates");
    try {
      const mid = await getUsdMidRate(
        input.product.recipientCurrency.toUpperCase(),
      );
      usdFace =
        mid.midRate > 0 ? input.unitPrice / mid.midRate : input.unitPrice;
    } catch {
      usdFace = input.unitPrice;
    }
  }

  const { getProviderMarkup } = await import("@/lib/pricing/service-pricing");
  const { applySilentCharge, getCompanyCharges } = await import(
    "@/lib/company/charges"
  );
  const markup = await getProviderMarkup("reloadly");
  const charges = await getCompanyCharges();
  const listed = roundMoney(usdFace * markup);
  const withCharge = applySilentCharge({
    base: listed,
    charge: charges.services.gift_card_buy ?? {
      mode: "flat",
      value: 0,
      enabled: false,
    },
  });
  const usdCharge = Math.max(0.01, roundMoney(withCharge.total));

  return {
    usdFace,
    usdCharge,
    local: usdCharge,
    currency: "USD" as const,
    ledgerNgn: usdCharge,
    rate: 1,
    midRate: 1,
    markup,
    companyCharge: withCharge.chargeAmount,
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
  productCountryCode?: string | null;
}) {
  if (isReloadlyDemoMode()) {
    throw new Error(
      "Gift card buying requires live Reloadly credentials. Set RELOADLY_CLIENT_ID / RELOADLY_CLIENT_SECRET and RELOADLY_DEMO=false.",
    );
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("Enter a valid email to receive the gift card");
  }
  if (!Number.isFinite(input.unitPrice) || input.unitPrice <= 0) {
    throw new Error("Select a valid card amount");
  }

  let product = await fetchReloadlyProduct(input.productId);
  if (!product) {
    const hint = (input.productCountryCode || "US").toUpperCase();
    const catalog = await fetchReloadlyProducts({ countryCode: hint });
    product = catalog.find((p) => p.productId === input.productId) ?? null;
  }
  if (!product) throw new Error("Gift card product not found");

  const orderCountryCode = (
    input.productCountryCode ||
    product.countryCode ||
    "US"
  )
    .trim()
    .toUpperCase();

  const amount = Number(input.unitPrice);
  const denomType = (product.denominationType || "FIXED").toUpperCase();
  if (denomType === "FIXED" && product.denominations.length) {
    const matches = product.denominations.some(
      (d) => Math.abs(Number(d) - amount) < 0.001,
    );
    if (!matches) {
      throw new Error("That amount isn't available for this card");
    }
  } else {
    if (product.minAmount != null && input.unitPrice < product.minAmount) {
      throw new Error(`Minimum amount is ${product.minAmount}`);
    }
    if (product.maxAmount != null && input.unitPrice > product.maxAmount) {
      throw new Error(`Maximum amount is ${product.maxAmount}`);
    }
  }

  const price = await quoteGiftCardBuy({
    product,
    unitPrice: input.unitPrice,
    countryCode: input.countryCode,
  });

  const quantity = Math.max(1, Math.floor(input.quantity || 1));
  const mappedSenderUsd = lookupSenderUsd(product.senderPriceMap, input.unitPrice);
  const minProviderBalance =
    mappedSenderUsd != null
      ? Math.max(0.01, mappedSenderUsd * quantity * 0.5)
      : 0.01;
  await assertReloadlyReady(minProviderBalance);

  const brand = await ensureBrand(product.brandName, product.brandName);
  const customIdentifier = `oryno-${randomUUID()}`;
  const reference = localReference();
  const usdTotal = roundMoney(price.usdCharge * quantity);

  await ensureUsdWallet(input.userId);
  const debit = await debitUsdWallet({
    userId: input.userId,
    amount: usdTotal,
    category: "gift_card",
    title: `Bought ${product.brandName} gift card`,
    subtitle: `${product.recipientCurrency} ${input.unitPrice} · ${product.name}`,
    metadata: {
      provider: "reloadly",
      side: "buy",
      productId: product.productId,
      unitPrice: input.unitPrice,
      usdFace: price.usdFace,
      usdCharge: price.usdCharge,
      quantity,
      productCountryCode: orderCountryCode,
      customIdentifier,
      orderReference: reference,
      countryCode: input.countryCode,
      balanceAffected: "USD",
      originalCurrency: "USD",
      originalAmount: usdTotal,
    },
  });

  const [order] = await db
    .insert(giftCardOrders)
    .values({
      reference,
      userId: input.userId,
      brandId: brand.id,
      side: "buy",
      amountUsd: price.usdFace.toFixed(2),
      localAmount: usdTotal.toFixed(2),
      currency: "USD",
      cardImageUrl: product.image,
      cardCodeEncrypted: null,
      status: "processing",
      transactionId: debit.transaction.id,
    })
    .returning();

  try {
    const { order: providerOrder, simulated } = await placeReloadlyOrder({
      productId: product.productId,
      countryCode: orderCountryCode,
      unitPrice: input.unitPrice,
      quantity,
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
        relatedOrderId: order.id,
        externalRef: String(providerOrder.transactionId || reference),
        metadata: {
          ...((debit.transaction.metadata as Record<string, unknown>) || {}),
          providerOrderId: providerOrder.transactionId,
          cardsDelivered: codePayload.length,
        },
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, debit.transaction.id));

    return {
      order,
      transactionId: debit.transaction.id,
      reference,
      providerTransactionId: providerOrder.transactionId,
      amount: usdTotal,
      currency: "USD" as const,
      amountFormatted: formatMoney(usdTotal, "USD"),
      wallet: debit.wallet,
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
      amount: usdTotal,
      reason,
    });
    await db
      .update(giftCardOrders)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(giftCardOrders.id, order.id));
    throw new Error(reason);
  }
}
