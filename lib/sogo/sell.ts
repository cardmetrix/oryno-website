import { createHash, randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  giftCardBrands,
  giftCardOrders,
  transactions,
  wallets,
} from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import { categoryForSlug, FALLBACK_DEMO_RATES_NGN } from "./catalog";
import {
  extractNgnRate,
  fetchSogoSellRates,
  isSogoDemoMode,
  sogoSellPayoutShare,
  submitSogoGiftCardSell,
} from "./client";
import { sogoErrorToEnglish } from "./errors";
import type {
  SogoCardType,
  SogoPhysicalSubType,
  SogoWebhookEvent,
} from "./types";

function redactCode(code?: string | null) {
  if (!code) return null;
  const trimmed = code.trim();
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.min(trimmed.length - 4, 12))}${trimmed.slice(-4)}`;
}

function hashCode(code?: string | null) {
  if (!code) return null;
  return createHash("sha256").update(code.trim()).digest("hex");
}

async function ensureBrand(slug: string, name?: string) {
  const normalized = slug.toLowerCase().trim();
  const existing = await db.query.giftCardBrands.findFirst({
    where: eq(giftCardBrands.slug, normalized),
  });
  if (existing) {
    if (existing.status === "soon" || existing.status === "disabled") {
      await db
        .update(giftCardBrands)
        .set({ status: "live", updatedAt: new Date() })
        .where(eq(giftCardBrands.id, existing.id));
    }
    return existing;
  }

  const display = (name || normalized).slice(0, 80);
  const [created] = await db
    .insert(giftCardBrands)
    .values({
      name: display,
      slug: normalized.slice(0, 80),
      category: categoryForSlug(normalized, display).slice(0, 80),
      status: "live",
    })
    .returning();

  if (created) return created;

  const again = await db.query.giftCardBrands.findFirst({
    where: eq(giftCardBrands.slug, normalized),
  });
  if (!again) throw new Error("Unable to resolve gift card brand");
  return again;
}

function localReference() {
  return `GC${Date.now().toString(36).toUpperCase()}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`.slice(0, 32);
}

export async function quoteGiftCardSell(input: {
  slug: string;
  cardCurrency: string;
  cardType: SogoCardType;
  subType?: SogoPhysicalSubType | null;
  cardAmount: number;
}) {
  const rates = await fetchSogoSellRates(input.slug);
  const entry =
    rates.find((r) => r.slug?.toLowerCase() === input.slug.toLowerCase()) ??
    rates[0];

  let ratePerUnit = extractNgnRate({
    entry,
    currency: input.cardCurrency,
    cardType: input.cardType,
    subType: input.subType,
  });

  // Fallbacks so the UI never 400s on odd provider payloads
  if (ratePerUnit == null || ratePerUnit <= 0) {
    ratePerUnit = extractNgnRate({
      entry,
      currency: "USD",
      cardType: "ecode",
    });
  }
  if (ratePerUnit == null || ratePerUnit <= 0) {
    ratePerUnit = FALLBACK_DEMO_RATES_NGN[input.slug] ?? 1400;
  }

  const providerPayout =
    Math.round(input.cardAmount * ratePerUnit * 100) / 100;
  const share = sogoSellPayoutShare();
  // userPayout follows provider payout exactly when share === 1
  const userPayout = Math.round(providerPayout * share * 100) / 100;

  return {
    ratePerUnit, // exact NGN-per-unit from provider (or demo mirror)
    providerPayout,
    userPayout,
    currency: "NGN" as const,
    share,
    demo: isSogoDemoMode(),
  };
}

export async function sellGiftCard(input: {
  userId: string;
  countryCode?: string | null;
  slug: string;
  brandName?: string;
  cardCountry: string;
  cardType: SogoCardType;
  subType?: SogoPhysicalSubType | null;
  cardCurrency: string;
  cardAmount: number;
  additionalInfo?: string | null;
  images?: { filename: string; mime: string; base64: string }[];
  specificCountry?: string | null;
  idempotencyKey?: string;
}) {
  if (!Number.isFinite(input.cardAmount) || input.cardAmount <= 0) {
    throw new Error("Enter a valid card amount");
  }
  if (input.cardType === "ecode" && !input.additionalInfo?.trim()) {
    throw new Error("Enter the gift card code");
  }
  if (input.cardType === "physical") {
    if (!input.subType) {
      throw new Error("Select a receipt type for physical cards");
    }
    if (!input.images?.length) {
      throw new Error("Upload at least one clear photo of the card");
    }
  }

  const quote = await quoteGiftCardSell({
    slug: input.slug,
    cardCurrency: input.cardCurrency,
    cardType: input.cardType,
    subType: input.subType,
    cardAmount: input.cardAmount,
  });

  const brand = await ensureBrand(input.slug, input.brandName);
  const walletCurrency = currencyForCountry(input.countryCode);
  // Sogo pays NGN; credit NGN wallet (primary for NG users)
  const creditCurrency = walletCurrency === "NGN" ? "NGN" : "NGN";
  const wallet = await ensurePrimaryWallet(input.userId, creditCurrency);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("Wallet is not available for payouts");
  }

  const idempotencyKey = input.idempotencyKey || randomUUID();
  const reference = localReference();

  const [order] = await db
    .insert(giftCardOrders)
    .values({
      reference,
      userId: input.userId,
      brandId: brand.id,
      side: "sell",
      amountUsd: input.cardAmount.toFixed(2),
      localAmount: quote.userPayout.toFixed(2),
      currency: creditCurrency,
      cardImageUrl: null,
      cardCodeEncrypted: hashCode(input.additionalInfo),
      status: "pending",
    })
    .returning();

  const [txRow] = await db
    .insert(transactions)
    .values({
      userId: input.userId,
      walletId: wallet.id,
      type: "credit",
      category: "gift_card",
      title: `Sold ${brand.name} gift card`,
      subtitle: `${input.cardCurrency} ${input.cardAmount} · ${input.cardType}`,
      amount: quote.userPayout.toFixed(2),
      currency: creditCurrency,
      status: "processing",
      balanceAfter: wallet.balance,
      externalRef: null,
      metadata: {
        provider: "sogo",
        side: "sell",
        orderId: order.id,
        orderReference: reference,
        slug: input.slug,
        cardCountry: input.cardCountry,
        cardType: input.cardType,
        subType: input.subType ?? null,
        cardCurrency: input.cardCurrency,
        cardAmount: input.cardAmount,
        codeHint: redactCode(input.additionalInfo),
        providerPayout: quote.providerPayout,
        userPayout: quote.userPayout,
        ratePerUnit: quote.ratePerUnit,
        idempotencyKey,
        demo: quote.demo,
      },
    })
    .returning();

  await db
    .update(giftCardOrders)
    .set({ transactionId: txRow.id, updatedAt: new Date() })
    .where(eq(giftCardOrders.id, order.id));

  try {
    const { data, simulated } = await submitSogoGiftCardSell({
      slug: input.slug,
      cardCountry: input.cardCountry.toUpperCase(),
      cardType: input.cardType,
      subType: input.subType,
      cardCurrency: input.cardCurrency.toUpperCase(),
      cardAmount: input.cardAmount,
      additionalInfo: input.additionalInfo,
      images: input.images,
      specificCountry: input.specificCountry,
      idempotencyKey,
    });

    // Lock to the provider's payout_amount — that is the live trade rate.
    const providerPayout = Number(
      data.payout_amount?.raw ?? quote.providerPayout,
    );
    const share = sogoSellPayoutShare();
    const userPayout = Math.round(providerPayout * share * 100) / 100;
    const lockedRatePerUnit =
      input.cardAmount > 0
        ? Math.round((providerPayout / input.cardAmount) * 10000) / 10000
        : quote.ratePerUnit;

    await db
      .update(giftCardOrders)
      .set({
        localAmount: userPayout.toFixed(2),
        status:
          data.status === "completed"
            ? "completed"
            : data.status === "cancelled"
              ? "cancelled"
              : "pending",
        updatedAt: new Date(),
      })
      .where(eq(giftCardOrders.id, order.id));

    await db
      .update(transactions)
      .set({
        amount: userPayout.toFixed(2),
        externalRef: data.reference,
        updatedAt: new Date(),
        metadata: {
          provider: "sogo",
          side: "sell",
          orderId: order.id,
          orderReference: reference,
          sogoReference: data.reference,
          sogoId: data.id,
          slug: input.slug,
          cardCountry: input.cardCountry,
          cardType: input.cardType,
          subType: input.subType ?? null,
          cardCurrency: input.cardCurrency,
          cardAmount: input.cardAmount,
          codeHint: redactCode(input.additionalInfo),
          providerPayout,
          userPayout,
          ratePerUnit: lockedRatePerUnit,
          idempotencyKey,
          demo: simulated,
          sogoStatus: data.status,
        },
      })
      .where(eq(transactions.id, txRow.id));

    // Demo / instant complete: credit immediately
    if (data.status === "completed") {
      const credited = await settleGiftCardSellSuccess({
        orderId: order.id,
        transactionId: txRow.id,
        userId: input.userId,
        amount: userPayout,
        providerReference: data.reference,
      });
      return {
        order: { ...order, status: "completed" as const, localAmount: userPayout.toFixed(2) },
        transactionId: txRow.id,
        reference: data.reference,
        localReference: reference,
        status: "completed" as const,
        amount: userPayout,
        currency: creditCurrency,
        wallet: credited.wallet,
        simulated,
        message: "Trade completed — wallet credited.",
      };
    }

    if (data.status === "cancelled") {
      await settleGiftCardSellFailure({
        orderId: order.id,
        transactionId: txRow.id,
        reason: "Card was rejected",
      });
      throw new Error(
        "This gift card could not be accepted. Check the code and try again.",
      );
    }

    return {
      order,
      transactionId: txRow.id,
      reference: data.reference,
      localReference: reference,
      status: "pending" as const,
      amount: userPayout,
      currency: creditCurrency,
      wallet: toWalletSummary(wallet),
      simulated,
      message:
        "Trade submitted for review. We’ll credit your wallet when it’s approved.",
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Failed to submit gift card";
    await settleGiftCardSellFailure({
      orderId: order.id,
      transactionId: txRow.id,
      reason,
    });
    throw new Error(sogoErrorToEnglish(reason));
  }
}

export async function settleGiftCardSellSuccess(input: {
  orderId: string;
  transactionId: string;
  userId: string;
  amount: number;
  providerReference?: string | null;
}) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.transactions.findFirst({
      where: eq(transactions.id, input.transactionId),
    });
    if (!existing) throw new Error("Transaction not found");
    if (existing.status === "completed") {
      const wallet = await tx.query.wallets.findFirst({
        where: eq(wallets.id, existing.walletId),
      });
      return {
        wallet: wallet ? toWalletSummary(wallet) : null,
        alreadySettled: true,
      };
    }

    const wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, existing.walletId),
    });
    if (!wallet) throw new Error("Wallet not found");

    const amount = Number(input.amount.toFixed(2));
    const next = (Number(wallet.balance) + amount).toFixed(2);

    const [updated] = await tx
      .update(wallets)
      .set({ balance: next, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();

    await tx
      .update(transactions)
      .set({
        status: "completed",
        amount: amount.toFixed(2),
        balanceAfter: next,
        externalRef: input.providerReference ?? existing.externalRef,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, existing.id));

    await tx
      .update(giftCardOrders)
      .set({
        status: "completed",
        localAmount: amount.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(giftCardOrders.id, input.orderId));

    return {
      wallet: toWalletSummary(updated ?? { ...wallet, balance: next }),
      alreadySettled: false,
    };
  });
}

export async function settleGiftCardSellFailure(input: {
  orderId: string;
  transactionId: string;
  reason: string;
}) {
  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.id, input.transactionId),
  });
  const prev = (existing?.metadata || {}) as Record<string, unknown>;

  await db
    .update(transactions)
    .set({
      status: "failed",
      updatedAt: new Date(),
      metadata: { ...prev, failureReason: input.reason },
    })
    .where(eq(transactions.id, input.transactionId));

  await db
    .update(giftCardOrders)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(giftCardOrders.id, input.orderId));
}

export async function handleSogoWebhookEvent(event: SogoWebhookEvent) {
  const reference = event.data?.reference;
  if (!reference) return { ok: true, ignored: true, reason: "no_reference" };

  const txRow = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.category, "gift_card"),
      eq(transactions.externalRef, reference),
    ),
  });

  if (!txRow) {
    return { ok: true, ignored: true, reason: "unknown_reference" };
  }

  const meta = (txRow.metadata || {}) as Record<string, unknown>;
  const orderId = typeof meta.orderId === "string" ? meta.orderId : null;
  if (!orderId) {
    return { ok: true, ignored: true, reason: "no_order" };
  }

  const name = event.event;

  if (name === "transaction.completed" || event.data.status === "completed") {
    // Prefer the provider's settled payout — never invent a different rate.
    const providerPayout = Number(
      typeof event.data.payout_amount === "object"
        ? event.data.payout_amount?.raw
        : event.data.payout_amount ??
            event.data.net_amount ??
            event.data.amount ??
            txRow.amount,
    );
    const share = sogoSellPayoutShare();
    const userPayout = Math.round(providerPayout * share * 100) / 100;

    const result = await settleGiftCardSellSuccess({
      orderId,
      transactionId: txRow.id,
      userId: txRow.userId,
      amount: userPayout,
      providerReference: reference,
    });

    if (!result.alreadySettled) {
      try {
        await createNotification({
          userId: txRow.userId,
          title: "Gift card sold",
          body: `₦${userPayout.toLocaleString("en-NG")} credited to your wallet.`,
          type: "gift_card",
          metadata: {
            href: `/history/${txRow.id}`,
            transactionId: txRow.id,
            reference,
          },
        });
      } catch (e) {
        console.error("[sogo-webhook-notify]", e);
      }
    }

    return { ok: true, settled: true, alreadySettled: result.alreadySettled };
  }

  if (
    name === "transaction.cancelled" ||
    name === "transaction.failed" ||
    name === "transaction.refunded" ||
    event.data.status === "cancelled" ||
    event.data.status === "failed"
  ) {
    if (txRow.status !== "completed") {
      await settleGiftCardSellFailure({
        orderId,
        transactionId: txRow.id,
        reason:
          event.data.failure_reason ||
          event.event ||
          "Gift card trade was cancelled",
      });

      try {
        await createNotification({
          userId: txRow.userId,
          title: "Gift card trade declined",
          body: "Your card could not be verified. No funds were credited.",
          type: "gift_card",
          metadata: {
            href: "/services/gift-cards",
            transactionId: txRow.id,
            reference,
          },
        });
      } catch (e) {
        console.error("[sogo-webhook-notify-fail]", e);
      }
    }

    return { ok: true, cancelled: true };
  }

  return { ok: true, ignored: true, reason: "unhandled_event" };
}
