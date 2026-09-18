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
import { getDisplayFx, nigeriaServiceLedgerCurrency } from "@/lib/display-currency";
import { convertLocalToNgn } from "@/lib/fx/rates";
import { priceLocalAmount } from "@/lib/pricing/service-pricing";
import { maybeSaveBeneficiary } from "@/lib/beneficiaries";
import {
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  generateVtpassRequestId,
  getIntlAirtimeOperators,
  getVtpassVariations,
  isVtpassDemoMode,
  isVtpassPendingCode,
  isVtpassSandbox,
  isVtpassSandboxTestPhone,
  isVtpassSuccessCode,
  normalizePhone,
  payVtpass,
  requeryVtpass,
} from "./client";
import {
  cleanNetworkName,
  fallbackVariationsFor,
  inferDataPlanCategory,
} from "./catalog";
import {
  intlDataLocalCurrency,
  intlDataMinError,
  intlDataMinLocal,
  intlDataVariationLabel,
} from "./intl-data";
import {
  intlAirtimeLocalCurrency,
  intlAirtimeMinLocal,
  intlAirtimeMinError,
} from "./intl-airtime";
import {
  zaAirtimeOperatorName,
} from "./za-airtime";
import { findKeDataPlan, keDataOperatorForPlan, keDataOperatorName, resolveKeDataOperatorId } from "./ke-data";
import { findZaDataPlan } from "./za-data";
import type { VtpassPayPayload, VtpassPayResponse } from "./types";

/** Face amount to provider; retail amount charged to wallet (admin markup/override). */
async function resolveVtpassRetail(input: {
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

async function lookupVariationFace(input: {
  serviceID: string;
  variationCode: string;
  fallbackAmount: number;
  operatorId?: string;
  productTypeId?: string | number;
  /** When true, only use catalog face for fixed-price plans */
  fixedOnly?: boolean;
}) {
  try {
    let variations;
    if (isVtpassDemoMode() && input.serviceID !== "foreign-airtime") {
      variations = fallbackVariationsFor(input.serviceID);
    } else {
      const live = await getVtpassVariations(input.serviceID, {
        operator_id: input.operatorId,
        product_type_id:
          input.productTypeId != null ? String(input.productTypeId) : undefined,
      });
      variations = live.variations;
    }
    const match = variations.find(
      (v) => v.variation_code === input.variationCode,
    );
    if (match) {
      const face = Number(match.charged_amount ?? match.variation_amount) || 0;
      const fixed = String(match.fixedPrice || "").toLowerCase() === "yes";
      if (input.fixedOnly) {
        if (fixed && face > 0) return face;
        return input.fallbackAmount;
      }
      if (face > 0) return face;
    }
  } catch {
    // fall through
  }
  return input.fallbackAmount;
}

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

  const currency = nigeriaServiceLedgerCurrency();
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
  await refundFailedDebit(input);
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
  if (row && status === "completed") {
    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(row.userId);
  }
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

function vtpassFailureMessage(
  response: VtpassPayResponse,
  fallback: string,
  phone?: string,
) {
  const base =
    response.response_description ||
    (response.code ? `Provider error (${response.code})` : null) ||
    fallback;

  if (
    isVtpassSandbox() &&
    phone &&
    !isVtpassSandboxTestPhone(phone)
  ) {
    return "VTpass sandbox only accepts test numbers (e.g. 08011111111 for successful airtime). Real numbers fail until live API access is approved.";
  }

  return base;
}

async function callProviderOrSimulate(payload: Parameters<typeof payVtpass>[0]) {
  if (isVtpassDemoMode()) {
    throw new Error(
      "VTpass is not configured for live purchases. Set VTPASS_API_KEY, VTPASS_PUBLIC_KEY, and VTPASS_SECRET_KEY.",
    );
  }

  const response = await payVtpass(payload);
  return { response, simulated: false as const };
}

/** Map catalog za-* ids to a live VTpass operator when possible. */
async function resolveIntlAirtimeOperator(input: {
  operatorId?: string;
  productTypeId?: string | number;
  countryIso?: string;
}) {
  const raw = String(input.operatorId || "").trim();
  if (!raw) throw new Error("Select a network");
  if (!raw.startsWith("za-") && !raw.startsWith("ke-")) return raw;

  const label =
    raw.startsWith("ke-")
      ? keDataOperatorName(raw)
      : zaAirtimeOperatorName(raw);
  if (!label) {
    throw new Error(
      raw.startsWith("ke-")
        ? "Unknown Kenya network"
        : "Unknown South Africa network",
    );
  }

  const country =
    input.countryIso || (raw.startsWith("ke-") ? "KE" : "ZA");
  const live = await getIntlAirtimeOperators(
    country,
    input.productTypeId ?? 1,
  );
  const needle = label.toLowerCase();
  const match = live.find((op) => {
    const name = cleanNetworkName(op.name).toLowerCase();
    return name.includes(needle) || needle.includes(name);
  });
  if (!match) {
    throw new Error(
      `${label} is not available from the live provider right now. Try again later.`,
    );
  }
  return String(match.operator_id);
}

async function resolveFlexibleIntlVariation(input: {
  operatorId: string;
  productTypeId?: string | number;
  localAmount: number;
}) {
  try {
    const live = await getVtpassVariations("foreign-airtime", {
      operator_id: input.operatorId,
      product_type_id:
        input.productTypeId != null ? String(input.productTypeId) : undefined,
    });
    const open = live.variations.find(
      (v) => String(v.fixedPrice || "").toLowerCase() !== "yes",
    );
    if (open?.variation_code) return open.variation_code;

    const closest = live.variations
      .map((v) => ({
        code: v.variation_code,
        face: Number(v.charged_amount ?? v.variation_amount) || 0,
      }))
      .filter((v) => v.code && v.face > 0)
      .sort(
        (a, b) =>
          Math.abs(a.face - input.localAmount) -
          Math.abs(b.face - input.localAmount),
      )[0];
    if (closest?.code) return closest.code;
    return live.variations[0]?.variation_code || undefined;
  } catch {
    return undefined;
  }
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
  /** When true, `amount` is local currency (e.g. ZAR) for flexible top-up. */
  flexibleLocalAmount?: boolean;
}) {
  if (input.mode !== "international") {
    const phone = normalizePhone(input.phone, input.countryCode || "NG");
    if (phone.length < 10) throw new Error("Enter a valid phone number");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Enter a valid amount");
    }
    const faceAmount = Math.round(input.amount);
    if (faceAmount < 50) throw new Error("Minimum airtime amount is ₦50");

    if (isVtpassSandbox() && !isVtpassSandboxTestPhone(phone)) {
      throw new Error(
        "VTpass sandbox only accepts test numbers. For airtime use 08011111111 (success). Real numbers only work after live API access is approved.",
      );
    }

    const priced = await resolveVtpassRetail({
      serviceID: input.serviceID,
      variationCode: input.variationCode,
      faceAmount,
    });
    const cashback = estimateAirtimeCashback(priced.retail);
    const market = resolveCountryCode(input.countryCode);
    const network = await ensureTelecomNetwork(market, input.serviceID);

    const prepared = await debitForPurchase({
      userId: input.userId,
      countryCode: input.countryCode,
      amount: priced.retail,
      category: "airtime",
      title: `${network.name} Airtime`,
      subtitle: phone,
      metadata: {
        serviceID: input.serviceID,
        mode: "local",
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
      const { response, simulated } = await callProviderOrSimulate({
        request_id: prepared.requestId,
        serviceID: input.serviceID,
        amount: priced.face,
        phone,
      });
      const outcome = mapVtpassOutcome(response);
      if (outcome === "failed") {
        throw new Error(
          vtpassFailureMessage(response, "Airtime purchase failed", phone),
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

      if (outcome === "completed" || outcome === "processing") {
        void maybeSaveBeneficiary({
          save: input.saveBeneficiary,
          userId: input.userId,
          phone,
          networkId: network.id,
          label: network.name,
        });
      }

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

  const phone = normalizePhone(input.phone, input.countryCode || input.countryIso);
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const market = resolveCountryCode(input.countryCode || input.countryIso);
  const flexibleIntl =
    Boolean(input.flexibleLocalAmount) ||
    (input.mode === "international" && !input.variationCode);

  let faceAmount = input.amount;
  let variationCode = input.variationCode;
  let operatorId = input.operatorId;

  if (flexibleIntl) {
    const minLocal = intlAirtimeMinLocal(market);
    if (input.amount < minLocal) {
      throw new Error(intlAirtimeMinError(market));
    }
    const fx = await getDisplayFx(input.countryCode || input.countryIso || market);
    faceAmount = convertLocalToNgn(input.amount, fx.localToNgn);
    operatorId = await resolveIntlAirtimeOperator({
      operatorId: input.operatorId,
      productTypeId: input.productTypeId,
      countryIso: input.countryIso || market,
    });
    variationCode =
      variationCode ||
      (await resolveFlexibleIntlVariation({
        operatorId,
        productTypeId: input.productTypeId,
        localAmount: input.amount,
      }));
  } else if (input.variationCode) {
    faceAmount = await lookupVariationFace({
      serviceID: "foreign-airtime",
      variationCode: input.variationCode,
      fallbackAmount: input.amount,
      operatorId: input.operatorId,
      productTypeId: input.productTypeId,
    });
  }

  const priced = await resolveVtpassRetail({
    serviceID: input.serviceID,
    variationCode,
    faceAmount,
  });
  const cashback = estimateAirtimeCashback(priced.retail);
  const network = await ensureTelecomNetwork(
    market,
    `foreign-${operatorId ?? input.operatorId ?? "airtime"}`,
  );

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "airtime",
    title: `${network.name} Airtime`,
    subtitle: phone,
    metadata: {
      serviceID: input.serviceID,
      mode: input.mode ?? "local",
      cashback,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
      localAmount: flexibleIntl ? input.amount : undefined,
      localCurrency: flexibleIntl
        ? intlAirtimeLocalCurrency(market)
        : undefined,
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
    const payload: VtpassPayPayload = {
      request_id: prepared.requestId,
      serviceID: "foreign-airtime",
      billersCode: phone,
      ...(variationCode ? { variation_code: variationCode } : {}),
      amount: flexibleIntl ? input.amount : priced.face,
      phone,
      operator_id: operatorId!,
      country_code: input.countryIso!,
      product_type_id: input.productTypeId!,
      email: input.email || "support@oryno.app",
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

    if (outcome === "completed" || outcome === "processing") {
      void maybeSaveBeneficiary({
        save: input.saveBeneficiary,
        userId: input.userId,
        phone,
        networkId: network.id,
        label: network.name,
      });
    }

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
  variationCode?: string;
  variationName?: string;
  amount: number;
  email?: string | null;
  mode?: "local" | "international";
  operatorId?: string;
  countryIso?: string;
  productTypeId?: string | number;
  /** When true, `amount` is local currency for flexible VTpass data top-up. */
  flexibleLocalAmount?: boolean;
  saveBeneficiary?: boolean;
}) {
  if (input.mode !== "international") {
    if (!input.variationCode) throw new Error("Select a data plan");
    const phone = normalizePhone(input.phone, input.countryCode || "NG");
    if (phone.length < 10) throw new Error("Enter a valid phone number");
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error("Enter a valid amount");
    }

    if (isVtpassSandbox() && !isVtpassSandboxTestPhone(phone)) {
      throw new Error(
        "VTpass sandbox only accepts test numbers. For data use 08011111111. Real numbers only work after live API access is approved.",
      );
    }

    const variationCode = input.variationCode;
    const variationName = input.variationName || variationCode;
    const faceAmount = await lookupVariationFace({
      serviceID: input.serviceID,
      variationCode,
      fallbackAmount: input.amount,
    });
    const priced = await resolveVtpassRetail({
      serviceID: input.serviceID,
      variationCode,
      faceAmount,
    });

    const country = (input.countryCode || "NG").toUpperCase().slice(0, 2);
    const network = await ensureTelecomNetwork(country, input.serviceID);
    const plan = await ensureDataPlan({
      networkId: network.id,
      variationCode,
      name: variationName,
      amount: priced.retail,
    });

    const prepared = await debitForPurchase({
      userId: input.userId,
      countryCode: input.countryCode,
      amount: priced.retail,
      category: "data",
      title: `${network.name} Data`,
      subtitle: `${variationName} · ${phone}`,
      metadata: {
        serviceID: input.serviceID,
        variationCode,
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
      const { response, simulated } = await callProviderOrSimulate({
        request_id: prepared.requestId,
        serviceID: input.serviceID,
        billersCode: phone,
        variation_code: variationCode,
        amount: priced.face,
        phone,
      });
      const outcome = mapVtpassOutcome(response);
      if (outcome === "failed") {
        throw new Error(
          vtpassFailureMessage(response, "Data purchase failed", phone),
        );
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

      if (outcome === "completed" || outcome === "processing") {
        void maybeSaveBeneficiary({
          save: input.saveBeneficiary,
          userId: input.userId,
          phone,
          networkId: network.id,
          label: network.name,
        });
      }

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

  const phone = normalizePhone(input.phone, input.countryCode || input.countryIso);
  if (phone.length < 10) throw new Error("Enter a valid phone number");
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const market = resolveCountryCode(input.countryCode || input.countryIso);
  const flexibleIntl =
    Boolean(input.flexibleLocalAmount) ||
    (input.mode === "international" && !input.variationCode);

  let faceAmount = input.amount;
  let variationCode = input.variationCode;
  let variationName =
    input.variationName ||
    (variationCode ? variationCode : intlDataVariationLabel(market, input.amount));
  let operatorId = input.operatorId;

  if (flexibleIntl) {
    const minLocal = intlDataMinLocal(market);
    if (input.amount < minLocal) {
      throw new Error(intlDataMinError(market));
    }
    const fx = await getDisplayFx(input.countryCode || input.countryIso || market);
    faceAmount = convertLocalToNgn(input.amount, fx.localToNgn);
    operatorId = await resolveIntlAirtimeOperator({
      operatorId: input.operatorId,
      productTypeId: input.productTypeId,
      countryIso: input.countryIso || market,
    });
    variationCode =
      variationCode ||
      (await resolveFlexibleIntlVariation({
        operatorId: operatorId!,
        productTypeId: input.productTypeId,
        localAmount: input.amount,
      }));
    if (!variationCode) {
      throw new Error(
        "Flexible data is not available for this network right now. Try again later.",
      );
    }
    variationName = intlDataVariationLabel(market, input.amount);
  } else if (!variationCode) {
    throw new Error("Select a data plan");
  }

  const zaPlan = findZaDataPlan(variationCode);
  if (zaPlan) {
    throw new Error(
      "South Africa data requires a live VTpass network. Refresh and select a live operator.",
    );
  }

  const kePlan = findKeDataPlan(variationCode!);
  if (kePlan) {
    const fx = await getDisplayFx(input.countryCode || input.countryIso || market);
    faceAmount = convertLocalToNgn(kePlan.kes, fx.localToNgn);
    variationName = kePlan.name;
    const catalogOperator =
      keDataOperatorForPlan(variationCode!) ||
      resolveKeDataOperatorId({ operatorId: input.operatorId }) ||
      input.operatorId;
    operatorId = await resolveIntlAirtimeOperator({
      operatorId: catalogOperator,
      productTypeId: input.productTypeId,
      countryIso: input.countryIso || market,
    });
    const liveCode = await resolveFlexibleIntlVariation({
      operatorId: operatorId!,
      productTypeId: input.productTypeId,
      localAmount: kePlan.kes,
    });
    if (liveCode) variationCode = liveCode;
  } else if (!flexibleIntl) {
    faceAmount = await lookupVariationFace({
      serviceID: "foreign-airtime",
      variationCode,
      fallbackAmount: input.amount,
      operatorId: input.operatorId,
      productTypeId: input.productTypeId,
    });
    if (input.operatorId?.startsWith("ke-")) {
      operatorId = await resolveIntlAirtimeOperator({
        operatorId: input.operatorId,
        productTypeId: input.productTypeId,
        countryIso: input.countryIso || market,
      });
    }
  }
  const priced = await resolveVtpassRetail({
    serviceID: input.serviceID,
    variationCode,
    faceAmount,
  });

  const country = (input.countryCode || "NG").toUpperCase().slice(0, 2);
  const network = await ensureTelecomNetwork(
    country,
    input.mode === "international"
      ? `foreign-${operatorId ?? input.operatorId ?? "data"}`
      : input.serviceID,
  );
  const plan = await ensureDataPlan({
    networkId: network.id,
    variationCode,
    name: variationName,
    amount: priced.retail,
  });

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "data",
    title: `${network.name} Data`,
    subtitle: `${variationName} · ${phone}`,
    metadata: {
      serviceID: input.serviceID,
      variationCode,
      faceAmount: priced.face,
      serviceKey: priced.serviceKey,
      localAmount: flexibleIntl ? input.amount : undefined,
      localCurrency: flexibleIntl ? intlDataLocalCurrency(market) : undefined,
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
    const payload =
      input.mode === "international"
        ? {
            request_id: prepared.requestId,
            serviceID: "foreign-airtime",
            billersCode: phone,
            variation_code: variationCode,
            amount: priced.face,
            phone,
            operator_id: operatorId ?? input.operatorId!,
            country_code: input.countryIso!,
            product_type_id: input.productTypeId!,
            email: input.email || "support@oryno.app",
          }
        : {
            request_id: prepared.requestId,
            serviceID: input.serviceID,
            billersCode: phone,
            variation_code: input.variationCode,
            amount: priced.face,
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

    if (outcome === "completed" || outcome === "processing") {
      void maybeSaveBeneficiary({
        save: input.saveBeneficiary,
        userId: input.userId,
        phone,
        networkId: network.id,
        label: network.name,
      });
    }

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
  category: "electricity" | "tv" | "water";
  customerRef: string;
  phone: string;
  amount: number;
  variationCode: string;
  subscriptionType?: string;
  quantity?: number;
}) {
  const country = (input.countryCode || "NG").toUpperCase();
  if (country === "ZA") {
    const { purchaseZaBill } = await import("@/lib/reloadly/utilities");
    return purchaseZaBill({
      userId: input.userId,
      countryCode: input.countryCode,
      serviceID: input.serviceID,
      serviceName: input.serviceName,
      category: input.category,
      customerRef: input.customerRef,
      phone: input.phone,
      amount: input.amount,
      variationCode: input.variationCode,
    });
  }
  if (country === "KE") {
    const { purchaseKenyaBill } = await import("@/lib/reloadly/utilities");
    return purchaseKenyaBill({
      userId: input.userId,
      countryCode: input.countryCode,
      serviceID: input.serviceID,
      serviceName: input.serviceName,
      category: input.category,
      customerRef: input.customerRef,
      phone: input.phone,
      amount: input.amount,
      variationCode: input.variationCode,
    });
  }
  if (country === "GH") {
    const { purchaseHubtelBill } = await import("@/lib/hubtel");
    return purchaseHubtelBill({
      userId: input.userId,
      countryCode: input.countryCode,
      serviceID: input.serviceID,
      serviceName: input.serviceName,
      category: input.category,
      customerRef: input.customerRef,
      phone: input.phone,
      amount: input.amount,
      variationCode: input.variationCode,
    });
  }
  if (input.category === "water") {
    throw Object.assign(
      new Error("Water bills are available for Ghana, Kenya, and South Africa accounts"),
      { status: 400 },
    );
  }

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

  const faceAmount = await lookupVariationFace({
    serviceID: input.serviceID,
    variationCode: input.variationCode,
    fallbackAmount: input.amount,
    fixedOnly: true,
  });
  const priced = await resolveVtpassRetail({
    serviceID: input.serviceID,
    variationCode: input.variationCode,
    faceAmount,
  });

  const billCategory = input.category === "tv" ? "tv" : "electricity";
  const provider = await ensureBillProvider({
    countryCode: country.slice(0, 2),
    serviceID: input.serviceID,
    name: input.serviceName,
    category: billCategory,
  });

  const prepared = await debitForPurchase({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: priced.retail,
    category: "bill",
    title: input.serviceName,
    subtitle: customerRef,
    metadata: {
      serviceID: input.serviceID,
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
    const payload = {
      request_id: prepared.requestId,
      serviceID: input.serviceID,
      billersCode: customerRef,
      variation_code: input.variationCode,
      amount: priced.face,
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

    const token = response.purchased_code || null;

    await db
      .update(billPayments)
      .set({
        status: outcome === "completed" ? "completed" : "processing",
        providerRef:
          response.content?.transactions?.transactionId || prepared.requestId,
        tokenOrReceipt: token,
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
    throw error instanceof Error ? error : new Error(reason);
  }
}

export async function requeryPurchase(requestId: string) {
  if (isVtpassDemoMode()) {
    throw new Error(
      "VTpass is not configured for live requery. Set VTPASS_API_KEY, VTPASS_PUBLIC_KEY, and VTPASS_SECRET_KEY.",
    );
  }
  return requeryVtpass(requestId);
}
