/**
 * Pairgate NG purchases: airtime, data, cable TV, electricity.
 */

import { and, eq } from "drizzle-orm";
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
import { resolveCountryCode } from "@/lib/country";
import { nigeriaServiceLedgerCurrency } from "@/lib/display-currency";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";
import { estimateAirtimeCashback } from "@/lib/telecom";
import { maybeCreditAirtimeCashback } from "@/lib/telecom/cashback";
import { inferDataPlanCategory } from "@/lib/vtpass/catalog";
import { normalizePhone } from "@/lib/vtpass/client";
import { maybeSaveBeneficiary } from "@/lib/beneficiaries";
import {
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  lookupPairgateCablePlanAmount,
  lookupPairgateDataPlanAmount,
  normalizePairgateDisco,
  normalizePairgateNetwork,
  normalizePairgateTv,
  pairgateMeterType,
} from "./catalog";
import {
  generatePairgateReference,
  isPairgateDataSuccess,
  isPairgateHttpOk,
  isPairgateSandbox,
  pairgateApiPath,
  pairgateErrorMessage,
  pairgateFetch,
  type PairgateEnvelope,
} from "./http";

const NETWORK_COLORS: Record<
  string,
  { color: string; soft: string; name: string }
> = {
  mtn: { name: "MTN", color: "#FFCC00", soft: "rgba(255, 204, 0, 0.16)" },
  airtel: { name: "Airtel", color: "#ED1C24", soft: "rgba(237, 28, 36, 0.14)" },
  glo: { name: "Glo", color: "#50B848", soft: "rgba(80, 184, 72, 0.14)" },
  "9mobile": {
    name: "9mobile",
    color: "#006F2D",
    soft: "rgba(0, 111, 45, 0.14)",
  },
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
  return (
    NETWORK_COLORS[slug] ?? {
      name: slug.toUpperCase(),
      color: "#FF6A00",
      soft: "rgba(255, 106, 0, 0.14)",
    }
  );
}

async function ensureTelecomNetwork(countryCode: string, serviceID: string) {
  const slug = normalizePairgateNetwork(serviceID).slice(0, 80);
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
      ? normalizePairgateTv(input.serviceID)
      : normalizePairgateDisco(input.serviceID);
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

  const currency = nigeriaServiceLedgerCurrency();
  const wallet = await ensurePrimaryWallet(input.userId, currency);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("Wallet is not available for payments");
  }

  if (Number(wallet.balance) < input.amount) {
    throw new Error("Insufficient wallet balance");
  }

  const requestId =
    typeof input.metadata?.requestId === "string"
      ? String(input.metadata.requestId)
      : generatePairgateReference(
          input.category === "airtime"
            ? "ORYAIR"
            : input.category === "data"
              ? "ORYDAT"
              : "ORYBIL",
        );
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
          provider: "pairgate",
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
      ...(typeof extra?.pairgateReference === "string"
        ? { externalRef: String(extra.pairgateReference) }
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

type PairgatePurchaseResult = {
  ok: boolean;
  referenceCode: string;
  message: string;
  processing: boolean;
  simulated: boolean;
  data: Record<string, unknown>;
  json: PairgateEnvelope;
};

function mapPurchaseResponse(
  input: {
    ok: boolean;
    status: number;
    json: PairgateEnvelope;
    clientRef: string;
  },
  fallbackFail: string,
): PairgatePurchaseResult {
  const data = input.json.data || {};
  const referenceCode = String(
    data.reference_code || input.clientRef,
  ).trim();
  const message = String(
    data.message || input.json.message || "",
  ).trim();

  if (isPairgateSandbox() && data.test_mode) {
    return {
      ok: true,
      referenceCode: referenceCode || `TEST-${input.clientRef}`,
      message: message || "Test purchase accepted",
      processing: false,
      simulated: true,
      data,
      json: input.json,
    };
  }

  const success =
    isPairgateHttpOk(input.ok, input.status, input.json) &&
    isPairgateDataSuccess(data, input.json);

  if (!success) {
    return {
      ok: false,
      referenceCode: input.clientRef,
      message: pairgateErrorMessage(input.json, fallbackFail),
      processing: false,
      simulated: false,
      data,
      json: input.json,
    };
  }

  const processing = /processing/i.test(message);

  return {
    ok: true,
    referenceCode,
    message: message || "Purchase accepted",
    processing,
    simulated: false,
    data,
    json: input.json,
  };
}

async function submitAirtime(input: {
  providerId: string;
  amount: number;
  recipient: string;
  reference: string;
}) {
  // Pairgate expects 11-digit 0XXXXXXXXXX (or 234…).
  let recipient = input.recipient.replace(/\D/g, "");
  if (recipient.startsWith("234") && recipient.length >= 13) {
    recipient = `0${recipient.slice(3)}`;
  } else if (recipient.length === 10 && /^[789]/.test(recipient)) {
    recipient = `0${recipient}`;
  }

  const reference = input.reference.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  const safeRef =
    reference.length >= 8
      ? reference
      : `${reference}${Date.now().toString(36)}`.slice(0, 100);

  const path = pairgateApiPath("/airtime/purchase", "/test/airtime/purchase");
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify({
      provider_id: input.providerId.toLowerCase(),
      amount: Math.round(input.amount),
      recipient,
      reference: safeRef,
    }),
  });
  return mapPurchaseResponse(
    { ok, status, json, clientRef: safeRef },
    "Airtime purchase failed",
  );
}

async function submitData(input: {
  providerId: string;
  planId: string;
  recipient: string;
  reference: string;
}) {
  const path = pairgateApiPath("/data/purchase", "/test/data/purchase");
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify({
      provider_id: input.providerId,
      plan_id: input.planId,
      recipient: input.recipient,
      reference: input.reference.slice(0, 100),
    }),
  });
  return mapPurchaseResponse(
    { ok, status, json, clientRef: input.reference },
    "Data purchase failed",
  );
}

async function submitCable(input: {
  providerId: string;
  planId: string;
  smartcard: string;
  recipientName?: string | null;
  reference: string;
}) {
  const path = pairgateApiPath("/cable/purchase", "/test/cable/purchase");
  const body: Record<string, unknown> = {
    provider_id: input.providerId,
    plan_id: input.planId,
    smartcard: input.smartcard,
    reference: input.reference.slice(0, 100),
  };
  if (input.recipientName?.trim()) {
    body.recipient_name = input.recipientName.trim();
  }
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapPurchaseResponse(
    { ok, status, json, clientRef: input.reference },
    "Cable subscription failed",
  );
}

async function submitElectricity(input: {
  providerId: string;
  amount: number;
  meterNumber: string;
  meterType: 1 | 2;
  recipientName?: string | null;
  reference: string;
}) {
  const path = pairgateApiPath(
    "/electricity/purchase",
    "/test/electricity/purchase",
  );
  const body: Record<string, unknown> = {
    provider_id: input.providerId,
    amount: Math.round(input.amount),
    meter_number: input.meterNumber,
    meter_type: input.meterType,
    reference: input.reference.slice(0, 100),
  };
  if (input.recipientName?.trim()) {
    body.recipient_name = input.recipientName.trim();
  }
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return mapPurchaseResponse(
    { ok, status, json, clientRef: input.reference },
    "Electricity purchase failed",
  );
}

export async function purchasePairgateAirtime(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  phone: string;
  amount: number;
  saveBeneficiary?: boolean;
}) {
  const phone = normalizePhone(input.phone, input.countryCode || "NG");
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }
  const faceAmount = Math.round(input.amount);
  if (faceAmount < 50) throw new Error("Minimum airtime amount is ₦50");

  const networkSlug = normalizePairgateNetwork(input.serviceID);
  const priced = await resolveRetail({
    serviceID: networkSlug,
    faceAmount,
  });
  const cashback = estimateAirtimeCashback(priced.face);
  const market = resolveCountryCode(input.countryCode);
  const network = await ensureTelecomNetwork(market, networkSlug);
  const requestId = generatePairgateReference("ORYAIR");

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "airtime",
    title: `${network.name} Airtime`,
    subtitle: phone,
    metadata: {
      requestId,
      serviceID: networkSlug,
      cashback,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
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
    const result = await submitAirtime({
      providerId: networkSlug,
      amount: priced.face,
      recipient: phone,
      reference: prepared.requestId,
    });
    if (!result.ok) throw new Error(result.message);

    await db
      .update(airtimeOrders)
      .set({
        status: "completed",
        providerRef: result.referenceCode || prepared.requestId,
        updatedAt: new Date(),
      })
      .where(eq(airtimeOrders.id, order.id));

    await finalizeTx(prepared.transaction.id, "completed", {
      provider: "pairgate",
      requestId: prepared.requestId,
      pairgateReference: result.referenceCode,
      pairgate: result.data,
      simulated: result.simulated,
      cashback,
      orderId: order.id,
    });

    const cashbackCredit = await maybeCreditAirtimeCashback({
      userId: input.userId,
      walletId: prepared.wallet.id,
      currency: prepared.currency,
      amount: cashback,
      purchaseTransactionId: prepared.transaction.id,
      phone,
      networkName: network.name,
    });

    const success = {
      order,
      transactionId: prepared.transaction.id,
      wallet:
        cashbackCredit &&
        "walletSummary" in cashbackCredit &&
        cashbackCredit.walletSummary
          ? cashbackCredit.walletSummary
          : toWalletSummary(prepared.wallet),
      requestId: result.referenceCode || prepared.requestId,
      status: "completed" as "completed" | "processing",
      cashback,
      simulated: result.simulated,
      response: result.data,
    };

    void maybeSaveBeneficiary({
      save: input.saveBeneficiary,
      userId: input.userId,
      phone,
      networkId: network.id,
      label: network.name,
    });

    return success;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Purchase failed";
    await refundFailedDebit({
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
    throw error instanceof Error ? error : new Error(reason);
  }
}

export async function purchasePairgateData(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  phone: string;
  variationCode: string;
  variationName: string;
  amount: number;
  saveBeneficiary?: boolean;
}) {
  const phone = normalizePhone(input.phone, input.countryCode || "NG");
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!input.variationCode) throw new Error("Select a data plan");

  const networkSlug = normalizePairgateNetwork(input.serviceID);
  const faceAmount = await lookupPairgateDataPlanAmount({
    serviceID: networkSlug,
    planId: input.variationCode,
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
  const requestId = generatePairgateReference("ORYDAT");

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "data",
    title: `${network.name} Data`,
    subtitle: `${input.variationName} · ${phone}`,
    metadata: {
      requestId,
      serviceID: networkSlug,
      variationCode: input.variationCode,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
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
    const result = await submitData({
      providerId: networkSlug,
      planId: input.variationCode,
      recipient: phone,
      reference: prepared.requestId,
    });
    if (!result.ok) throw new Error(result.message);

    await db
      .update(dataOrders)
      .set({
        status: "completed",
        providerRef: result.referenceCode || prepared.requestId,
        updatedAt: new Date(),
      })
      .where(eq(dataOrders.id, order.id));

    await finalizeTx(prepared.transaction.id, "completed", {
      provider: "pairgate",
      requestId: prepared.requestId,
      pairgateReference: result.referenceCode,
      pairgate: result.data,
      simulated: result.simulated,
      orderId: order.id,
    });

    const success = {
      order,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: result.referenceCode || prepared.requestId,
      status: "completed" as "completed" | "processing",
      simulated: result.simulated,
      response: result.data,
    };

    void maybeSaveBeneficiary({
      save: input.saveBeneficiary,
      userId: input.userId,
      phone,
      networkId: network.id,
      label: network.name,
    });

    return success;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Purchase failed";
    await refundFailedDebit({
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
    throw error instanceof Error ? error : new Error(reason);
  }
}

export async function purchasePairgateBill(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  serviceName: string;
  category: "electricity" | "tv";
  customerRef: string;
  phone: string;
  amount: number;
  variationCode: string;
  recipientName?: string | null;
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

  const serviceID =
    input.category === "tv"
      ? normalizePairgateTv(input.serviceID)
      : normalizePairgateDisco(input.serviceID);

  let faceAmount = input.amount;
  if (input.category === "tv") {
    faceAmount = await lookupPairgateCablePlanAmount({
      serviceID,
      planId: input.variationCode,
      fallbackAmount: input.amount,
    });
  } else if (input.amount < 1000) {
    throw new Error("Minimum electricity amount is ₦1,000");
  }

  if (input.category === "tv" && faceAmount < 100) {
    throw new Error("Minimum bill amount is ₦100");
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
  const requestId = generatePairgateReference("ORYBIL");

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "bill",
    title: input.serviceName,
    subtitle: customerRef,
    metadata: {
      requestId,
      serviceID,
      variationCode: input.variationCode,
      billCategory: input.category,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
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
    const result =
      input.category === "electricity"
        ? await submitElectricity({
            providerId: serviceID,
            amount: priced.face,
            meterNumber: customerRef,
            meterType: pairgateMeterType(input.variationCode),
            recipientName: input.recipientName,
            reference: prepared.requestId,
          })
        : await submitCable({
            providerId: serviceID,
            planId: input.variationCode,
            smartcard: customerRef,
            recipientName: input.recipientName,
            reference: prepared.requestId,
          });

    if (!result.ok) throw new Error(result.message);

    const pin =
      typeof result.data.pin === "string" && result.data.pin.trim()
        ? String(result.data.pin).trim()
        : null;

    // Electricity tokens arrive via webhook; stay processing unless we already
    // have a pin (sandbox / rare sync responses). Cable completes on accept.
    const finalStatus =
      input.category === "electricity" && !result.simulated && !pin
        ? ("processing" as const)
        : ("completed" as const);

    await db
      .update(billPayments)
      .set({
        status: finalStatus,
        // Keep Pairgate TRX code as providerRef for webhook matching.
        // Client ORYBIL… ref stays on the transaction metadata.requestId.
        providerRef: result.referenceCode || prepared.requestId,
        ...(pin ? { tokenOrReceipt: pin } : {}),
        updatedAt: new Date(),
      })
      .where(eq(billPayments.id, payment.id));

    await finalizeTx(prepared.transaction.id, finalStatus, {
      provider: "pairgate",
      requestId: prepared.requestId,
      pairgateReference: result.referenceCode,
      pairgate: result.data,
      simulated: result.simulated,
      orderId: payment.id,
      billCategory: input.category,
      ...(pin ? { token: pin } : {}),
    });

    return {
      payment: {
        ...payment,
        status: finalStatus,
        providerRef: result.referenceCode || prepared.requestId,
        tokenOrReceipt: pin,
      },
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: result.referenceCode || prepared.requestId,
      status: finalStatus,
      simulated: result.simulated,
      response: result.data,
      token: pin,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Payment failed";
    await refundFailedDebit({
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
    throw error instanceof Error ? error : new Error(reason);
  }
}
