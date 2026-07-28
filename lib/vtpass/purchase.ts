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
import { estimateAirtimeCashback } from "@/lib/telecom";
import { resolveCountryCode } from "@/lib/country";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import {
  generateVtpassRequestId,
  isVtpassDemoMode,
  isVtpassPendingCode,
  isVtpassSuccessCode,
  normalizePhone,
  payVtpass,
  requeryVtpass,
} from "./client";
import { inferDataPlanCategory } from "./catalog";
import type { VtpassPayResponse } from "./types";

const NETWORK_COLORS: Record<
  string,
  { color: string; soft: string; name: string }
> = {
  mtn: {
    name: "MTN",
    color: "#FFCC00",
    soft: "rgba(255, 204, 0, 0.16)",
  },
  airtel: {
    name: "Airtel",
    color: "#ED1C24",
    soft: "rgba(237, 28, 36, 0.14)",
  },
  glo: {
    name: "Glo",
    color: "#50B848",
    soft: "rgba(80, 184, 72, 0.14)",
  },
  etisalat: {
    name: "9mobile",
    color: "#006F2D",
    soft: "rgba(0, 111, 45, 0.14)",
  },
  "9mobile": {
    name: "9mobile",
    color: "#006F2D",
    soft: "rgba(0, 111, 45, 0.14)",
  },
};

function networkMeta(serviceID: string) {
  const key = serviceID.replace(/-data$/, "").replace(/-sme-data$/, "");
  return (
    NETWORK_COLORS[key] ?? {
      name: serviceID.toUpperCase(),
      color: "#FF6A00",
      soft: "rgba(255, 106, 0, 0.14)",
    }
  );
}

async function ensureTelecomNetwork(countryCode: string, serviceID: string) {
  const slug = serviceID.slice(0, 80);
  const existing = await db.query.telecomNetworks.findFirst({
    where: and(
      eq(telecomNetworks.countryCode, countryCode),
      eq(telecomNetworks.slug, slug),
    ),
  });
  if (existing) return existing;

  const meta = networkMeta(serviceID);
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
  const slug = input.serviceID.slice(0, 80);
  const existing = await db.query.billProviders.findFirst({
    where: and(
      eq(billProviders.countryCode, input.countryCode),
      eq(billProviders.slug, slug),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(billProviders)
    .values({
      countryCode: input.countryCode,
      name: input.name.slice(0, 120),
      slug,
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
      eq(billProviders.slug, slug),
    ),
  });
  if (!again) throw new Error("Unable to resolve bill provider");
  return again;
}

type DebitPrepared = {
  wallet: typeof wallets.$inferSelect;
  transaction: typeof transactions.$inferSelect;
  nextBalance: string;
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

  const balance = Number(wallet.balance);
  if (balance < input.amount) {
    throw new Error("Insufficient wallet balance");
  }

  const requestId = generateVtpassRequestId(
    input.category === "airtime" ? "AIR" : input.category === "data" ? "DAT" : "BIL",
  );
  const amountStr = input.amount.toFixed(2);
  const nextBalance = (balance - input.amount).toFixed(2);

  const prepared = await db.transaction(async (tx) => {
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
          provider: "vtpass",
          requestId,
          ...(input.metadata ?? {}),
        },
      })
      .returning();

    return {
      wallet: updated ?? { ...current, balance: next },
      transaction: txRow,
      nextBalance: next,
      amount: input.amount,
      currency,
      requestId,
    };
  });

  return prepared;
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
        metadata: {
          failureReason: input.reason,
        },
      })
      .where(eq(transactions.id, input.transactionId));
  });
}

async function finalizeTx(
  transactionId: string,
  status: "completed" | "processing" | "failed",
  extra?: Record<string, unknown>,
) {
  const [row] = await db
    .update(transactions)
    .set({
      status,
      updatedAt: new Date(),
      metadata: extra,
    })
    .where(eq(transactions.id, transactionId))
    .returning();
  return row;
}

function mapVtpassOutcome(response: VtpassPayResponse) {
  const code = response.code;
  const status = response.content?.transactions?.status?.toLowerCase();
  if (isVtpassSuccessCode(code) || status === "delivered" || status === "success") {
    return "completed" as const;
  }
  if (isVtpassPendingCode(code) || status === "pending" || status === "initiated") {
    return "processing" as const;
  }
  return "failed" as const;
}

async function callProviderOrSimulate(payload: Parameters<typeof payVtpass>[0]) {
  if (isVtpassDemoMode()) {
    const simulated: VtpassPayResponse = {
      code: "000",
      response_description: "TRANSACTION SUCCESSFUL (demo)",
      requestId: payload.request_id,
      amount: payload.amount,
      purchased_code: "",
      content: {
        transactions: {
          status: "delivered",
          product_name: payload.serviceID,
          unique_element: payload.billersCode || payload.phone,
          amount: payload.amount,
          transactionId: `demo_${payload.request_id}`,
        },
      },
    };
    return { response: simulated, simulated: true as const };
  }

  const response = await payVtpass(payload);
  return { response, simulated: false as const };
}

export async function purchaseAirtime(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  phone: string;
  amount: number;
  saveBeneficiary?: boolean;
  mode?: "local" | "international";
  email?: string | null;
  operatorId?: string;
  countryIso?: string;
  productTypeId?: string | number;
  variationCode?: string;
}) {
  const phone = normalizePhone(input.phone);
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }
  if (input.amount < 50 && input.mode !== "international") {
    throw new Error("Minimum airtime amount is ₦50");
  }

  const cashback = estimateAirtimeCashback(input.amount);
  const market = resolveCountryCode(input.countryCode);
  const network = await ensureTelecomNetwork(
    market,
    input.mode === "international"
      ? `foreign-${input.operatorId ?? "airtime"}`
      : input.serviceID,
  );

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: input.amount,
    category: "airtime",
    title: `${network.name} Airtime`,
    subtitle: phone,
    metadata: {
      serviceID: input.serviceID,
      mode: input.mode ?? "local",
      cashback,
    },
  });

  const [order] = await db
    .insert(airtimeOrders)
    .values({
      userId: input.userId,
      networkId: network.id,
      phone,
      amount: input.amount.toFixed(2),
      cashbackAmount: cashback.toFixed(2),
      status: "processing",
      saveBeneficiary: Boolean(input.saveBeneficiary),
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const payload =
      input.mode === "international"
        ? {
            request_id: prepared.requestId,
            serviceID: "foreign-airtime",
            billersCode: phone,
            variation_code: input.variationCode!,
            amount: input.amount,
            phone,
            operator_id: input.operatorId!,
            country_code: input.countryIso!,
            product_type_id: input.productTypeId!,
            email: input.email || "support@oryno.app",
          }
        : {
            request_id: prepared.requestId,
            serviceID: input.serviceID,
            amount: input.amount,
            phone,
          };

    const { response, simulated } = await callProviderOrSimulate(payload);
    const outcome = mapVtpassOutcome(response);

    if (outcome === "failed") {
      throw new Error(
        response.response_description || "Airtime purchase failed",
      );
    }

    await db
      .update(airtimeOrders)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef:
          response.content?.transactions?.transactionId || prepared.requestId,
        updatedAt: new Date(),
      })
      .where(eq(airtimeOrders.id, order.id));

    await finalizeTx(
      prepared.transaction.id,
      outcome === "completed" ? "completed" : "processing",
      {
        provider: "vtpass",
        requestId: prepared.requestId,
        vtpass: response,
        simulated,
        cashback,
        orderId: order.id,
      },
    );

    return {
      order,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: prepared.requestId,
      status: outcome,
      cashback,
      simulated,
      response,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Purchase failed";
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
    throw error instanceof Error ? error : new Error(reason);
  }
}

export async function purchaseData(input: {
  userId: string;
  countryCode?: string | null;
  serviceID: string;
  phone: string;
  variationCode: string;
  variationName: string;
  amount: number;
  email?: string | null;
  mode?: "local" | "international";
  operatorId?: string;
  countryIso?: string;
  productTypeId?: string | number;
}) {
  const phone = normalizePhone(input.phone);
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!input.variationCode) throw new Error("Select a data plan");

  const country = (input.countryCode || "NG").toUpperCase().slice(0, 2);
  const network = await ensureTelecomNetwork(
    country,
    input.mode === "international"
      ? `foreign-${input.operatorId ?? "data"}`
      : input.serviceID,
  );
  const plan = await ensureDataPlan({
    networkId: network.id,
    variationCode: input.variationCode,
    name: input.variationName,
    amount: input.amount,
  });

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: input.amount,
    category: "data",
    title: `${network.name} Data`,
    subtitle: `${input.variationName} · ${phone}`,
    metadata: {
      serviceID: input.serviceID,
      variationCode: input.variationCode,
    },
  });

  const [order] = await db
    .insert(dataOrders)
    .values({
      userId: input.userId,
      networkId: network.id,
      planId: plan.id,
      phone,
      amount: input.amount.toFixed(2),
      status: "processing",
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const payload =
      input.mode === "international"
        ? {
            request_id: prepared.requestId,
            serviceID: "foreign-airtime",
            billersCode: phone,
            variation_code: input.variationCode,
            amount: input.amount,
            phone,
            operator_id: input.operatorId!,
            country_code: input.countryIso!,
            product_type_id: input.productTypeId!,
            email: input.email || "support@oryno.app",
          }
        : {
            request_id: prepared.requestId,
            serviceID: input.serviceID,
            billersCode: phone,
            variation_code: input.variationCode,
            amount: input.amount,
            phone,
          };

    const { response, simulated } = await callProviderOrSimulate(payload);
    const outcome = mapVtpassOutcome(response);
    if (outcome === "failed") {
      throw new Error(response.response_description || "Data purchase failed");
    }

    await db
      .update(dataOrders)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef:
          response.content?.transactions?.transactionId || prepared.requestId,
        updatedAt: new Date(),
      })
      .where(eq(dataOrders.id, order.id));

    await finalizeTx(
      prepared.transaction.id,
      outcome === "completed" ? "completed" : "processing",
      {
        provider: "vtpass",
        requestId: prepared.requestId,
        vtpass: response,
        simulated,
        orderId: order.id,
      },
    );

    return {
      order,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: prepared.requestId,
      status: outcome,
      simulated,
      response,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Purchase failed";
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
    throw error instanceof Error ? error : new Error(reason);
  }
}

export async function purchaseBill(input: {
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
  quantity?: number;
}) {
  const phone = normalizePhone(input.phone);
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

  const country = (input.countryCode || "NG").toUpperCase().slice(0, 2);
  const provider = await ensureBillProvider({
    countryCode: country,
    serviceID: input.serviceID,
    name: input.serviceName,
    category: input.category,
  });

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: input.amount,
    category: "bill",
    title: input.serviceName,
    subtitle: customerRef,
    metadata: {
      serviceID: input.serviceID,
      variationCode: input.variationCode,
      billCategory: input.category,
    },
  });

  const [payment] = await db
    .insert(billPayments)
    .values({
      userId: input.userId,
      providerId: provider.id,
      customerRef,
      amount: input.amount.toFixed(2),
      status: "processing",
      transactionId: prepared.transaction.id,
      providerRef: prepared.requestId,
    })
    .returning();

  try {
    const payload = {
      request_id: prepared.requestId,
      serviceID: input.serviceID,
      billersCode: customerRef,
      variation_code: input.variationCode,
      amount: input.amount,
      phone: phone || "08011111111",
      ...(input.category === "electricity"
        ? { type: input.variationCode }
        : {}),
      ...(input.subscriptionType
        ? { subscription_type: input.subscriptionType }
        : {}),
      ...(input.quantity ? { quantity: input.quantity } : {}),
    };

    const { response, simulated } = await callProviderOrSimulate(payload);
    const outcome = mapVtpassOutcome(response);
    if (outcome === "failed") {
      throw new Error(response.response_description || "Bill payment failed");
    }

    const token =
      response.purchased_code ||
      (typeof response.content?.transactions === "object"
        ? undefined
        : undefined);

    await db
      .update(billPayments)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef:
          response.content?.transactions?.transactionId || prepared.requestId,
        tokenOrReceipt: token || null,
        updatedAt: new Date(),
      })
      .where(eq(billPayments.id, payment.id));

    await finalizeTx(
      prepared.transaction.id,
      outcome === "completed" ? "completed" : "processing",
      {
        provider: "vtpass",
        requestId: prepared.requestId,
        vtpass: response,
        simulated,
        orderId: payment.id,
      },
    );

    return {
      payment,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      requestId: prepared.requestId,
      status: outcome,
      simulated,
      response,
      token: token || null,
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
    throw error instanceof Error ? error : new Error(reason);
  }
}

export async function requeryPurchase(requestId: string) {
  if (isVtpassDemoMode()) {
    return {
      code: "000",
      response_description: "TRANSACTION SUCCESSFUL (demo)",
      requestId,
      content: { transactions: { status: "delivered" } },
    } satisfies VtpassPayResponse;
  }
  return requeryVtpass(requestId);
}
