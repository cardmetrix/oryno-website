import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { bettingOrders, transactions, wallets } from "@/lib/db/schema";
import { getDisplayFx, nigeriaServiceLedgerCurrency } from "@/lib/display-currency";
import { formatMoney } from "@/lib/transactions";
import {
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  findBettingProvider,
  normalizeBettingCustomerId,
} from "./catalog";
import { fundBettingAccount, verifyBettingCustomer } from "./client";
import type { BettingFundResult } from "./types";

type DebitPrepared = {
  wallet: typeof wallets.$inferSelect;
  transaction: typeof transactions.$inferSelect;
  amount: number;
  currency: string;
  requestId: string;
};

async function debitForBetting(input: {
  userId: string;
  countryCode?: string | null;
  amount: number;
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}): Promise<DebitPrepared> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("Enter a valid amount"), { status: 400 });
  }

  const currency = nigeriaServiceLedgerCurrency();
  const wallet = await ensurePrimaryWallet(input.userId, currency);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw Object.assign(new Error("Wallet is not available for payments"), {
      status: 422,
    });
  }

  if (Number(wallet.balance) < input.amount) {
    throw Object.assign(new Error("Insufficient wallet balance"), {
      status: 422,
      code: "insufficient_funds",
    });
  }

  const requestId = input.metadata?.idempotencyKey
    ? String(input.metadata.idempotencyKey)
    : randomUUID().replace(/-/g, "").slice(0, 24);
  const amountStr = input.amount.toFixed(2);

  return db.transaction(async (tx) => {
    const current = await tx.query.wallets.findFirst({
      where: eq(wallets.id, wallet.id),
    });
    if (!current) throw new Error("Wallet not found");
    if (Number(current.balance) < input.amount) {
      throw Object.assign(new Error("Insufficient wallet balance"), {
        status: 422,
        code: "insufficient_funds",
      });
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
        category: "betting",
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency,
        status: "processing",
        balanceAfter: next,
        relatedOrderType: "betting",
        externalRef: requestId,
        metadata: {
          provider: "vtu-africa",
          requestId,
          ...(input.metadata ?? {}),
        },
      })
      .returning();

    return {
      wallet: updated ?? { ...current, balance: next },
      transaction: txRow,
      amount: input.amount,
      currency,
      requestId,
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

async function finalizeTx(
  transactionId: string,
  status: "completed" | "processing" | "failed",
  extra?: Record<string, unknown>,
) {
  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
  });
  const prev = (existing?.metadata || {}) as Record<string, unknown>;
  const [row] = await db
    .update(transactions)
    .set({
      status,
      updatedAt: new Date(),
      metadata: { ...prev, ...extra },
      ...(typeof extra?.providerRef === "string"
        ? { externalRef: extra.providerRef }
        : {}),
    })
    .where(eq(transactions.id, transactionId))
    .returning();
  if (row && status === "completed") {
    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(row.userId);
  }
  return row;
}

export async function fundBettingWallet(input: {
  userId: string;
  countryCode?: string | null;
  phone?: string | null;
  serviceID: string;
  serviceName?: string;
  customerRef: string;
  customerName?: string | null;
  amount: number;
}): Promise<BettingFundResult> {
  await ensureWalletSchema();

  const country = (input.countryCode || "NG").toUpperCase();
  const provider = findBettingProvider(input.serviceID, country);
  if (!provider) {
    throw Object.assign(new Error("Unknown betting provider"), { status: 400 });
  }

  const customerRef = normalizeBettingCustomerId(input.customerRef);
  if (customerRef.length < 6) {
    throw Object.assign(new Error("Enter a valid betting account ID"), {
      status: 400,
    });
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < provider.minAmount) {
    throw Object.assign(
      new Error(`Minimum funding is ₦${provider.minAmount}`),
      { status: 400 },
    );
  }
  if (amount > provider.maxAmount) {
    throw Object.assign(
      new Error(`Maximum funding is ₦${provider.maxAmount.toLocaleString("en-NG")}`),
      { status: 400 },
    );
  }

  const verified = await verifyBettingCustomer({
    serviceID: provider.serviceID,
    customerId: customerRef,
    countryCode: country,
  });
  if (!verified.ok) {
    throw Object.assign(
      new Error(verified.message || "Could not verify betting account"),
      { status: 422 },
    );
  }

  const customerName = input.customerName?.trim() || verified.customerName;
  const requestId = `BET${Date.now()}${randomUUID().replace(/-/g, "").slice(0, 8)}`.slice(
    0,
    32,
  );

  const prepared = await debitForBetting({
    userId: input.userId,
    countryCode: country,
    amount,
    title: `${provider.name} funding`,
    subtitle: `${customerRef}${customerName ? ` · ${customerName}` : ""}`,
    metadata: {
      serviceID: provider.serviceID,
      customerRef,
      customerName,
      idempotencyKey: requestId,
    },
  });

  const [order] = await db
    .insert(bettingOrders)
    .values({
      userId: input.userId,
      providerSlug: provider.serviceID,
      providerName: provider.name,
      customerRef,
      customerName,
      amount: amount.toFixed(2),
      status: "processing",
      transactionId: prepared.transaction.id,
      metadata: { requestId, demo: verified.demo },
    })
    .returning();

  await db
    .update(transactions)
    .set({
      relatedOrderId: order.id,
      relatedOrderType: "betting",
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, prepared.transaction.id));

  try {
    const funded = await fundBettingAccount({
      serviceID: provider.serviceID,
      customerId: customerRef,
      amount,
      reference: requestId,
      phone: input.phone,
      countryCode: country,
    });

    if (!funded.ok) {
      throw Object.assign(new Error(funded.message || "Betting funding failed"), {
        status: 422,
      });
    }

    await db
      .update(bettingOrders)
      .set({
        status: "completed",
        providerRef: funded.reference,
        updatedAt: new Date(),
      })
      .where(eq(bettingOrders.id, order.id));

    await finalizeTx(prepared.transaction.id, "completed", {
      providerRef: funded.reference,
      simulated: funded.demo,
      token: funded.reference,
    });

    const wallet = await ensurePrimaryWallet(input.userId, prepared.currency);
    const fx = await getDisplayFx(country);
    const summary = toWalletSummary(wallet, fx);

    return {
      status: "completed",
      simulated: funded.demo,
      wallet: {
        id: summary.id,
        currency: summary.currency,
        balance: summary.balance,
        balanceFormatted: summary.balanceFormatted,
        status: summary.status,
        isPrimary: summary.isPrimary,
      },
      orderId: order.id,
      transactionId: prepared.transaction.id,
      requestId,
      amount,
      customerName,
      token: funded.reference,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Betting funding failed";
    await db
      .update(bettingOrders)
      .set({
        status: "failed",
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(bettingOrders.id, order.id));
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    throw error;
  }
}

export function formatBettingAmount(amount: number, currency = "NGN") {
  return formatMoney(amount, currency);
}
