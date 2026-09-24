import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { billPayments, billProviders, transactions, wallets } from "@/lib/db/schema";
import { localServiceLedgerCurrency } from "@/lib/display-currency";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import { ensurePrimaryWallet, toWalletSummary } from "@/lib/wallet";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";
import { findHubtelBillService } from "./catalog";
import { isHubtelDemoMode, payHubtelBill, verifyHubtelCustomer } from "./client";
import { hubtelErrorToEnglish } from "./errors";
import type { HubtelBillCategory } from "./types";

async function ensureGhanaBillProvider(input: {
  serviceID: string;
  name: string;
  category: HubtelBillCategory;
}) {
  const slug = input.serviceID.trim().toLowerCase().slice(0, 80);
  const dbCategory = input.category === "water" ? "utility" : input.category;
  const existing = await db.query.billProviders.findFirst({
    where: and(
      eq(billProviders.countryCode, "GH"),
      eq(billProviders.slug, slug),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(billProviders)
    .values({
      countryCode: "GH",
      name: input.name.slice(0, 120),
      slug,
      category: dbCategory,
      description: input.name,
      accent: "#FF6A00",
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const again = await db.query.billProviders.findFirst({
    where: and(
      eq(billProviders.countryCode, "GH"),
      eq(billProviders.slug, slug),
    ),
  });
  if (!again) throw new Error("Unable to resolve Ghana bill provider");
  return again;
}

async function debitLocal(input: {
  userId: string;
  amount: number;
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw Object.assign(new Error("Enter a valid amount"), { status: 400 });
  }
  const currency = localServiceLedgerCurrency("GH");
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

  const requestId = String(input.metadata?.idempotencyKey || randomUUID());
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
        category: "bill",
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency,
        status: "processing",
        balanceAfter: next,
        externalRef: requestId,
        metadata: {
          provider: "hubtel",
          requestId,
          balanceAffected: currency,
          originalCurrency: currency,
          originalAmount: input.amount,
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

export async function purchaseHubtelBill(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  serviceName: string;
  category: HubtelBillCategory;
  customerRef: string;
  phone?: string;
  amount: number;
  variationCode: string;
}) {
  const service = findHubtelBillService(input.serviceID);
  if (!service || service.category !== input.category) {
    throw Object.assign(new Error("Unknown Ghana bill provider"), { status: 400 });
  }

  const customerRef = input.customerRef.trim();
  if (customerRef.length < 6) {
    throw Object.assign(new Error(`Enter a valid ${service.customerLabel.toLowerCase()}`), {
      status: 400,
    });
  }
  if (!input.variationCode) {
    throw Object.assign(new Error("Select a plan or meter type"), { status: 400 });
  }

  const ghsAmount = Number(input.amount);
  if (!Number.isFinite(ghsAmount) || ghsAmount < service.minAmount) {
    throw Object.assign(
      new Error(`Minimum amount is GH₵${service.minAmount}`),
      { status: 400 },
    );
  }
  if (ghsAmount > service.maxAmount) {
    throw Object.assign(
      new Error(`Maximum amount is GH₵${service.maxAmount.toLocaleString("en-GH")}`),
      { status: 400 },
    );
  }

  const verified = await verifyHubtelCustomer({
    serviceID: service.serviceID,
    customerRef,
    variationCode: input.variationCode,
  });
  if (!verified.ok) {
    throw Object.assign(
      new Error(verified.message || "Could not verify that account"),
      { status: 422 },
    );
  }

  const priced = await priceLocalAmount({
    provider: "vtpass",
    serviceKey: `hubtel:${service.serviceID}:${input.variationCode}`,
    amount: ghsAmount,
  });

  const provider = await ensureGhanaBillProvider({
    serviceID: service.serviceID,
    name: input.serviceName || service.name,
    category: service.category,
  });
  const idempotencyKey = `GHB${Date.now()}${randomUUID().replace(/-/g, "").slice(0, 8)}`.slice(
    0,
    32,
  );

  const prepared = await debitLocal({
    userId: input.userId,
    amount: priced.local,
    title: input.serviceName || service.name,
    subtitle: `${customerRef}${verified.customerName ? ` · ${verified.customerName}` : ""}`,
    metadata: {
      serviceID: service.serviceID,
      variationCode: input.variationCode,
      billCategory: service.category,
      faceGhs: ghsAmount,
      customerName: verified.customerName,
      idempotencyKey,
    },
  });

  const [payment] = await db
    .insert(billPayments)
    .values({
      userId: input.userId,
      providerId: provider.id,
      customerRef,
      amount: priced.local.toFixed(2),
      status: "processing",
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const paid = await payHubtelBill({
      serviceID: service.serviceID,
      variationCode: input.variationCode,
      customerRef,
      amount: ghsAmount,
      reference: idempotencyKey,
    });

    if (!paid.ok) {
      throw Object.assign(new Error(paid.message || "Ghana bill payment failed"), {
        status: 422,
      });
    }

    const status = paid.pending ? "processing" : "completed";
    await db
      .update(billPayments)
      .set({
        status,
        providerRef: paid.transactionId || paid.reference,
        tokenOrReceipt: paid.token,
        updatedAt: new Date(),
      })
      .where(eq(billPayments.id, payment.id));

    const prev = (prepared.transaction.metadata || {}) as Record<string, unknown>;
    await db
      .update(transactions)
      .set({
        status,
        relatedOrderId: payment.id,
        relatedOrderType: "bill",
        externalRef: paid.transactionId || paid.reference,
        updatedAt: new Date(),
        metadata: {
          ...prev,
          provider: "hubtel",
          hubtel: paid.raw ?? null,
          simulated: paid.demo,
          token: paid.token,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

    if (status === "completed") {
      const { scheduleReferralCheck } = await import("@/lib/referrals/service");
      scheduleReferralCheck(input.userId);
    }

    const wallet = await ensurePrimaryWallet(input.userId, prepared.currency);
    return {
      payment,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(wallet),
      requestId: paid.reference,
      status,
      simulated: paid.demo,
      token: paid.token,
    };
  } catch (error) {
    const reason = hubtelErrorToEnglish(
      error instanceof Error ? error.message : "Ghana bill payment failed",
    );
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    await db
      .update(billPayments)
      .set({
        status: "failed",
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(billPayments.id, payment.id));
    throw Object.assign(new Error(reason), {
      status: (error as { status?: number } | null)?.status ?? 400,
    });
  }
}
