import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  airtimeOrders,
  billPayments,
  billProviders,
  dataOrders,
  dataPlans,
  telecomNetworks,
  transactions,
  wallets,
} from "@/lib/db/schema";
import { estimateAirtimeCashback } from "@/lib/telecom";
import { resolveCountryCode } from "@/lib/country";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";
import { inferDataPlanCategory } from "@/lib/vtpass/catalog";
import {
  displayNetworkName,
  extractSogoToken,
  lookupSogoPlanAmount,
  mapSogoBillStatus,
  normalizeSogoDisco,
  normalizeSogoNetwork,
  normalizeSogoTvProvider,
  submitSogoAirtime,
  submitSogoCableTv,
  submitSogoData,
  submitSogoElectricity,
  toSogoPhone,
} from "./bills";
import { sogoErrorToEnglish } from "./errors";
import { fetchSogoNgnBalance } from "./client";
import type { SogoWebhookEvent } from "./types";

const NETWORK_COLORS: Record<
  string,
  { color: string; soft: string; name: string }
> = {
  mtn: { name: "MTN", color: "#FFCC00", soft: "rgba(255, 204, 0, 0.16)" },
  airtel: { name: "Airtel", color: "#ED1C24", soft: "rgba(237, 28, 36, 0.14)" },
  glo: { name: "Glo", color: "#50B848", soft: "rgba(80, 184, 72, 0.14)" },
  t2mobile: {
    name: "9mobile",
    color: "#006F2D",
    soft: "rgba(0, 111, 45, 0.14)",
  },
  smile: { name: "Smile", color: "#00AEEF", soft: "rgba(0, 174, 239, 0.14)" },
};

async function resolveRetail(input: {
  serviceID: string;
  variationCode?: string | null;
  faceAmount: number;
}) {
  const serviceKey = input.variationCode
    ? `${input.serviceID}:${input.variationCode}`
    : `${input.serviceID}:open`;
  const priced = await priceLocalAmount({
    provider: "vtpass",
    serviceKey,
    amount: input.faceAmount,
  });
  return {
    face: input.faceAmount,
    retail: priced.local,
    serviceKey,
    overrideApplied: priced.overrideApplied,
  };
}

function networkMeta(slug: string) {
  const key = normalizeSogoNetwork(slug);
  return (
    NETWORK_COLORS[key] ?? {
      name: displayNetworkName(key),
      color: "#FF6A00",
      soft: "rgba(255, 106, 0, 0.14)",
    }
  );
}

async function ensureTelecomNetwork(countryCode: string, serviceID: string) {
  const slug = normalizeSogoNetwork(serviceID).slice(0, 80);
  const existing = await db.query.telecomNetworks.findFirst({
    where: and(
      eq(telecomNetworks.countryCode, countryCode),
      eq(telecomNetworks.slug, slug),
    ),
  });
  if (existing) return existing;

  const meta = networkMeta(slug);
  const [created] = await db
    .insert(telecomNetworks)
    .values({
      countryCode,
      name: meta.name,
      slug,
      color: meta.color,
      softColor: meta.soft,
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const again = await db.query.telecomNetworks.findFirst({
    where: and(
      eq(telecomNetworks.countryCode, countryCode),
      eq(telecomNetworks.slug, slug),
    ),
  });
  if (!again) throw new Error("Unable to resolve telecom network");
  return again;
}

async function ensureDataPlan(input: {
  networkId: string;
  variationCode: string;
  name: string;
  amount: number;
}) {
  const existing = await db.query.dataPlans.findFirst({
    where: and(
      eq(dataPlans.networkId, input.networkId),
      eq(dataPlans.externalPlanCode, input.variationCode),
    ),
  });
  if (existing) return existing;

  const category = inferDataPlanCategory(input.name);
  const [created] = await db
    .insert(dataPlans)
    .values({
      networkId: input.networkId,
      name: input.name.slice(0, 120),
      size: input.name.slice(0, 40),
      validity: category,
      price: input.amount.toFixed(2),
      category,
      popular: false,
      active: true,
      externalPlanCode: input.variationCode.slice(0, 80),
    })
    .returning();

  return created;
}

async function ensureBillProvider(input: {
  countryCode: string;
  serviceID: string;
  name: string;
  category: "electricity" | "tv";
}) {
  const slug =
    input.category === "tv"
      ? normalizeSogoTvProvider(input.serviceID)
      : normalizeSogoDisco(input.serviceID);
  const existing = await db.query.billProviders.findFirst({
    where: and(
      eq(billProviders.countryCode, input.countryCode),
      eq(billProviders.slug, slug.slice(0, 80)),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(billProviders)
    .values({
      countryCode: input.countryCode,
      name: input.name.slice(0, 120),
      slug: slug.slice(0, 80),
      category: input.category,
      description: input.name,
      accent: "#FF6A00",
      status: "active",
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const again = await db.query.billProviders.findFirst({
    where: and(
      eq(billProviders.countryCode, input.countryCode),
      eq(billProviders.slug, slug.slice(0, 80)),
    ),
  });
  if (!again) throw new Error("Unable to resolve bill provider");
  return again;
}

type DebitPrepared = {
  wallet: typeof wallets.$inferSelect;
  transaction: typeof transactions.$inferSelect;
  amount: number;
  currency: string;
  requestId: string;
};

async function debitForPurchase(input: {
  userId: string;
  countryCode?: string | null;
  amount: number;
  category: "airtime" | "data" | "bill";
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}): Promise<DebitPrepared> {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const currency = currencyForCountry(input.countryCode);
  const wallet = await ensurePrimaryWallet(input.userId, currency);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("Wallet is not available for payments");
  }

  if (Number(wallet.balance) < input.amount) {
    throw new Error("Insufficient wallet balance");
  }

  const requestId = input.metadata?.idempotencyKey
    ? String(input.metadata.idempotencyKey)
    : randomUUID();
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
        category: input.category,
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency,
        status: "processing",
        balanceAfter: next,
        externalRef: requestId,
        metadata: {
          provider: "sogo",
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
  await db.transaction(async (tx) => {
    const existing = await tx.query.transactions.findFirst({
      where: eq(transactions.id, input.transactionId),
    });
    if (!existing || existing.status === "failed") return;
    if (existing.status === "completed") return;

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

    const prev = (existing.metadata || {}) as Record<string, unknown>;
    await tx
      .update(transactions)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: { ...prev, failureReason: input.reason },
      })
      .where(eq(transactions.id, input.transactionId));
  });
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
      ...(typeof extra?.sogoReference === "string"
        ? { externalRef: extra.sogoReference }
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

async function assertSogoWallet(amount: number) {
  const balance = await fetchSogoNgnBalance();
  if (balance == null) return;
  if (balance + 0.0001 >= amount) return;
  console.error("[sogo-wallet] NGN balance too low", { balance, amount });
  const err = new Error(
    "This service is temporarily unavailable. Please try again shortly.",
  ) as Error & { status?: number; code?: string };
  err.status = 503;
  err.code = "insufficient_funds";
  throw err;
}

function rethrowSogo(error: unknown, fallback: string): never {
  const err = error as { status?: number; code?: string; message?: string };
  const wrapped = new Error(
    sogoErrorToEnglish(err.message || fallback, err.code),
  ) as Error & { status?: number; code?: string };
  wrapped.code = err.code;
  wrapped.status =
    err.code === "insufficient_funds" ? 503 : err.status;
  throw wrapped;
}

export async function purchaseSogoAirtime(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  phone: string;
  amount: number;
  saveBeneficiary?: boolean;
}) {
  const phone = toSogoPhone(input.phone);
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }
  if (input.amount < 50) throw new Error("Minimum airtime amount is ₦50");

  const networkSlug = normalizeSogoNetwork(input.serviceID);
  const priced = await resolveRetail({
    serviceID: networkSlug,
    faceAmount: input.amount,
  });
  const cashback = estimateAirtimeCashback(priced.retail);
  const market = resolveCountryCode(input.countryCode);
  const network = await ensureTelecomNetwork(market, networkSlug);
  const idempotencyKey = randomUUID();
  await assertSogoWallet(priced.face);

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "airtime",
    title: `${network.name} Airtime`,
    subtitle: phone,
    metadata: {
      serviceID: networkSlug,
      cashback,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
      idempotencyKey,
    },
  });

  const [order] = await db
    .insert(airtimeOrders)
    .values({
      userId: input.userId,
      networkId: network.id,
      phone,
      amount: priced.retail.toFixed(2),
      cashbackAmount: cashback.toFixed(2),
      status: "processing",
      saveBeneficiary: Boolean(input.saveBeneficiary),
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const { data, simulated } = await submitSogoAirtime({
      network: networkSlug,
      phone,
      amount: priced.face,
      idempotencyKey,
    });
    const outcome = mapSogoBillStatus(data.status);
    if (outcome === "failed") {
      throw new Error("Airtime purchase failed");
    }

    await db
      .update(airtimeOrders)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef: data.reference || prepared.requestId,
        updatedAt: new Date(),
      })
      .where(eq(airtimeOrders.id, order.id));

    await finalizeTx(
      prepared.transaction.id,
      outcome === "completed" ? "completed" : "processing",
      {
        provider: "sogo",
        requestId: prepared.requestId,
        sogoReference: data.reference,
        sogo: data,
        simulated,
        cashback,
        orderId: order.id,
      },
    );

    return {
      order,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: data.reference || prepared.requestId,
      status: outcome,
      cashback,
      simulated,
      response: data,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Purchase failed";
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    await db
      .update(airtimeOrders)
      .set({
        status: "failed",
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(airtimeOrders.id, order.id));
    rethrowSogo(error, reason);
  }
}

export async function purchaseSogoData(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  phone: string;
  variationCode: string;
  variationName: string;
  amount: number;
}) {
  const phone = toSogoPhone(input.phone);
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!input.variationCode) throw new Error("Select a data plan");

  const networkSlug = normalizeSogoNetwork(input.serviceID);
  const faceAmount = await lookupSogoPlanAmount({
    kind: "data",
    serviceID: networkSlug,
    variationCode: input.variationCode,
    fallbackAmount: input.amount,
  });
  const priced = await resolveRetail({
    serviceID: networkSlug,
    variationCode: input.variationCode,
    faceAmount,
  });

  const country = (input.countryCode || "NG").toUpperCase().slice(0, 2);
  const network = await ensureTelecomNetwork(country, networkSlug);
  const plan = await ensureDataPlan({
    networkId: network.id,
    variationCode: input.variationCode,
    name: input.variationName,
    amount: priced.retail,
  });
  const idempotencyKey = randomUUID();
  await assertSogoWallet(priced.face);

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "data",
    title: `${network.name} Data`,
    subtitle: `${input.variationName} · ${phone}`,
    metadata: {
      serviceID: networkSlug,
      variationCode: input.variationCode,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
      idempotencyKey,
    },
  });

  const [order] = await db
    .insert(dataOrders)
    .values({
      userId: input.userId,
      networkId: network.id,
      planId: plan.id,
      phone,
      amount: priced.retail.toFixed(2),
      status: "processing",
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const { data, simulated } = await submitSogoData({
      network: networkSlug,
      phone,
      variationCode: input.variationCode,
      amount: priced.face,
      idempotencyKey,
    });
    const outcome = mapSogoBillStatus(data.status);
    if (outcome === "failed") {
      throw new Error("Data purchase failed");
    }

    await db
      .update(dataOrders)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef: data.reference || prepared.requestId,
        updatedAt: new Date(),
      })
      .where(eq(dataOrders.id, order.id));

    await finalizeTx(
      prepared.transaction.id,
      outcome === "completed" ? "completed" : "processing",
      {
        provider: "sogo",
        requestId: prepared.requestId,
        sogoReference: data.reference,
        sogo: data,
        simulated,
        orderId: order.id,
      },
    );

    return {
      order,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: data.reference || prepared.requestId,
      status: outcome,
      simulated,
      response: data,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Purchase failed";
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    await db
      .update(dataOrders)
      .set({
        status: "failed",
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(dataOrders.id, order.id));
    rethrowSogo(error, reason);
  }
}

export async function purchaseSogoBill(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  serviceName: string;
  category: "electricity" | "tv";
  customerRef: string;
  phone: string;
  amount: number;
  variationCode: string;
  subscriptionType?: string;
}) {
  const customerRef = input.customerRef.trim();
  if (customerRef.length < 6) {
    throw new Error(
      input.category === "tv"
        ? "Enter a valid smartcard number"
        : "Enter a valid meter number",
    );
  }
  if (!input.variationCode) throw new Error("Select a plan or meter type");
  if (input.amount < 100) throw new Error("Minimum bill amount is ₦100");

  const serviceID =
    input.category === "tv"
      ? normalizeSogoTvProvider(input.serviceID)
      : normalizeSogoDisco(input.serviceID);

  let faceAmount = input.amount;
  if (input.category === "tv") {
    faceAmount = await lookupSogoPlanAmount({
      kind: "tv",
      serviceID,
      variationCode: input.variationCode,
      fallbackAmount: input.amount,
    });
  }

  const priced = await resolveRetail({
    serviceID,
    variationCode: input.variationCode,
    faceAmount,
  });

  const country = (input.countryCode || "NG").toUpperCase().slice(0, 2);
  const provider = await ensureBillProvider({
    countryCode: country,
    serviceID,
    name: input.serviceName,
    category: input.category,
  });
  const idempotencyKey = randomUUID();
  await assertSogoWallet(priced.face);

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "bill",
    title: input.serviceName,
    subtitle: customerRef,
    metadata: {
      serviceID,
      variationCode: input.variationCode,
      billCategory: input.category,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
      idempotencyKey,
    },
  });

  const [payment] = await db
    .insert(billPayments)
    .values({
      userId: input.userId,
      providerId: provider.id,
      customerRef,
      amount: priced.retail.toFixed(2),
      status: "processing",
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const submitted =
      input.category === "electricity"
        ? await submitSogoElectricity({
            discoSlug: serviceID,
            meterNumber: customerRef,
            meterType:
              input.variationCode === "postpaid" ? "postpaid" : "prepaid",
            amount: priced.face,
            idempotencyKey,
          })
        : await submitSogoCableTv({
            provider: serviceID,
            smartcardNumber: customerRef,
            variationCode: input.variationCode,
            amount: priced.face,
            subscriptionType: input.subscriptionType || "renew",
            idempotencyKey,
          });

    const { data, simulated } = submitted;
    const outcome = mapSogoBillStatus(data.status);
    if (outcome === "failed") {
      throw new Error("Bill payment failed");
    }

    const token = extractSogoToken(data as Record<string, unknown>);

    await db
      .update(billPayments)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef: data.reference || prepared.requestId,
        tokenOrReceipt: token,
        updatedAt: new Date(),
      })
      .where(eq(billPayments.id, payment.id));

    await finalizeTx(
      prepared.transaction.id,
      outcome === "completed" ? "completed" : "processing",
      {
        provider: "sogo",
        requestId: prepared.requestId,
        sogoReference: data.reference,
        sogo: data,
        simulated,
        orderId: payment.id,
        token,
      },
    );

    return {
      payment,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: data.reference || prepared.requestId,
      status: outcome,
      simulated,
      response: data,
      token,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Payment failed";
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
    rethrowSogo(error, reason);
  }
}

export async function handleSogoBillsWebhook(event: SogoWebhookEvent) {
  const reference = event.data?.reference;
  if (!reference) return { ok: true, ignored: true, reason: "no_reference" };

  const txRow = await db.query.transactions.findFirst({
    where: and(
      inArray(transactions.category, ["airtime", "data", "bill"]),
      eq(transactions.externalRef, reference),
    ),
  });

  if (!txRow) {
    return { ok: true, ignored: true, reason: "unknown_reference" };
  }

  const meta = (txRow.metadata || {}) as Record<string, unknown>;
  const orderId = typeof meta.orderId === "string" ? meta.orderId : null;
  const name = event.event;
    const token = extractSogoToken(event.data as Record<string, unknown>);

  if (name === "transaction.completed" || event.data.status === "completed") {
    if (txRow.status !== "completed") {
      await finalizeTx(txRow.id, "completed", {
        sogoWebhook: event.event,
        token,
      });
      if (txRow.category === "airtime" && orderId) {
        await db
          .update(airtimeOrders)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(airtimeOrders.id, orderId));
      }
      if (txRow.category === "data" && orderId) {
        await db
          .update(dataOrders)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(dataOrders.id, orderId));
      }
      if (txRow.category === "bill" && orderId) {
        await db
          .update(billPayments)
          .set({
            status: "completed",
            tokenOrReceipt: token,
            updatedAt: new Date(),
          })
          .where(eq(billPayments.id, orderId));
      }
    }
    return { ok: true, settled: true };
  }

  if (
    name === "transaction.cancelled" ||
    name === "transaction.failed" ||
    name === "transaction.refunded" ||
    event.data.status === "cancelled" ||
    event.data.status === "failed" ||
    event.data.status === "refunded"
  ) {
    if (txRow.status !== "completed" && txRow.status !== "failed") {
      await refundDebit({
        walletId: txRow.walletId,
        transactionId: txRow.id,
        amount: Number(txRow.amount),
        reason: event.data.failure_reason || event.event || "Payment reversed",
      });
      if (txRow.category === "airtime" && orderId) {
        await db
          .update(airtimeOrders)
          .set({
            status: "failed",
            failureReason: event.data.failure_reason || event.event,
            updatedAt: new Date(),
          })
          .where(eq(airtimeOrders.id, orderId));
      }
      if (txRow.category === "data" && orderId) {
        await db
          .update(dataOrders)
          .set({
            status: "failed",
            failureReason: event.data.failure_reason || event.event,
            updatedAt: new Date(),
          })
          .where(eq(dataOrders.id, orderId));
      }
      if (txRow.category === "bill" && orderId) {
        await db
          .update(billPayments)
          .set({
            status: "failed",
            failureReason: event.data.failure_reason || event.event,
            updatedAt: new Date(),
          })
          .where(eq(billPayments.id, orderId));
      }
    }
    return { ok: true, refunded: true };
  }

  return { ok: true, ignored: true, reason: "unhandled_event" };
}
