import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { usdVirtualCardOrders, usdVirtualCards, users } from "@/lib/db/schema";
import { resolveCountryCode } from "@/lib/country";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
  isPaymentSuccessful,
  normalizeFlutterwaveMeta,
} from "@/lib/flutterwave/client";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import { localToBuyUsd } from "@/lib/fx/rates";
import { countryFromCurrency, flutterwavePaymentOptions } from "@/lib/payments/country";
import { createNotification } from "@/lib/notifications-service";
import { USD_CARD_ISSUER } from "@/lib/support/config";
import { formatMoney } from "@/lib/transactions";
import { ensureUsdWallet } from "@/lib/wallet-usd";
import { currencyForCountry } from "@/lib/wallet";

export const CARD_ISSUE_FEE_USD = Number(
  process.env.USD_VIRTUAL_CARD_FEE || "1.5",
);
export const MAX_ACTIVE_CARDS = 3;

type InitCheckoutData = {
  link?: string;
  authorization_url?: string;
};

function encryptionKey() {
  const raw =
    process.env.VIRTUAL_CARD_ENCRYPTION_KEY ||
    process.env.FLUTTERWAVE_SECRET_KEY ||
    process.env.NEXTAUTH_SECRET ||
    "oryno-dev-virtual-card-key";
  return createHash("sha256").update(raw).digest();
}

function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

function decryptSecret(payload: string) {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid card secret");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

function luhnCheckDigit(partial: string) {
  let sum = 0;
  let double = true;
  for (let i = partial.length - 1; i >= 0; i -= 1) {
    let n = Number(partial[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Generate a Visa-like sandbox PAN (Luhn-valid). */
function generatePan() {
  const bin = "424242";
  let body = bin;
  while (body.length < 15) {
    body += String(Math.floor(Math.random() * 10));
  }
  return body + luhnCheckDigit(body);
}

function generateCvv() {
  return String(Math.floor(100 + Math.random() * 900));
}

function formatPanGroups(pan: string) {
  return pan.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export type VirtualCardSummary = {
  id: string;
  brand: string;
  label: string;
  last4: string;
  expMonth: number;
  expYear: number;
  expLabel: string;
  status: "active" | "frozen" | "terminated";
  provider: string;
  maskedNumber: string;
  createdAt: string;
};

export type VirtualCardOrderSummary = {
  id: string;
  status:
    | "pending_payment"
    | "paid_pending_review"
    | "approved"
    | "rejected"
    | "issued";
  feeUsd: number;
  feeFormatted: string;
  localAmount: number;
  localCurrency: string;
  localFormatted: string;
  paymentRef: string | null;
  paidAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

function toSummary(
  row: typeof usdVirtualCards.$inferSelect,
): VirtualCardSummary {
  return {
    id: row.id,
    brand: row.brand,
    label: row.label,
    last4: row.last4,
    expMonth: row.expMonth,
    expYear: row.expYear,
    expLabel: `${String(row.expMonth).padStart(2, "0")}/${String(row.expYear).slice(-2)}`,
    status: row.status,
    provider: row.provider,
    maskedNumber: `•••• •••• •••• ${row.last4}`,
    createdAt: row.createdAt.toISOString(),
  };
}

function toOrderSummary(
  row: typeof usdVirtualCardOrders.$inferSelect,
): VirtualCardOrderSummary {
  const feeUsd = Number(row.feeUsd);
  const localAmount = Number(row.localAmount);
  return {
    id: row.id,
    status: row.status,
    feeUsd,
    feeFormatted: formatMoney(feeUsd, "USD"),
    localAmount,
    localCurrency: row.localCurrency,
    localFormatted: formatMoney(localAmount, row.localCurrency),
    paymentRef: row.paymentRef,
    paidAt: row.paidAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listUserVirtualCards(userId: string) {
  const rows = await db.query.usdVirtualCards.findMany({
    where: and(
      eq(usdVirtualCards.userId, userId),
      ne(usdVirtualCards.status, "terminated"),
    ),
    orderBy: [desc(usdVirtualCards.createdAt)],
  });
  return rows.map(toSummary);
}

export async function getLatestOpenCardOrder(userId: string) {
  const row = await db.query.usdVirtualCardOrders.findFirst({
    where: and(
      eq(usdVirtualCardOrders.userId, userId),
      inArray(usdVirtualCardOrders.status, [
        "pending_payment",
        "paid_pending_review",
      ]),
    ),
    orderBy: [desc(usdVirtualCardOrders.createdAt)],
  });
  return row ? toOrderSummary(row) : null;
}

/** Internal: create the card record after admin approval (fee already paid via Flutterwave). */
export async function issueVirtualCard(input: {
  userId: string;
  fullName: string;
  label?: string;
  orderId?: string;
  paymentRef?: string | null;
}) {
  const existing = await listUserVirtualCards(input.userId);
  if (existing.length >= MAX_ACTIVE_CARDS) {
    throw new Error(
      `You can have up to ${MAX_ACTIVE_CARDS} active USD cards. Freeze or terminate one first.`,
    );
  }

  const usdWallet = await ensureUsdWallet(input.userId);
  const pan = generatePan();
  const cvv = generateCvv();
  const now = new Date();
  const expMonth = now.getMonth() + 1;
  const expYear = now.getFullYear() + 3;
  const label =
    input.label?.trim() ||
    `${input.fullName.split(" ")[0] || "ORYNO"} USD Card`;

  const [created] = await db
    .insert(usdVirtualCards)
    .values({
      userId: input.userId,
      walletId: usdWallet.id,
      brand: "visa",
      label: label.slice(0, 80),
      last4: pan.slice(-4),
      expMonth,
      expYear,
      panCipher: encryptSecret(pan),
      cvvCipher: encryptSecret(cvv),
      status: "active",
      provider: "oryno",
      externalRef: input.paymentRef || null,
      metadata: {
        issuer: USD_CARD_ISSUER,
        feeUsd: CARD_ISSUE_FEE_USD,
        orderId: input.orderId ?? null,
        paidVia: "flutterwave",
      },
    })
    .returning();

  return {
    card: toSummary(created),
    feeUsd: CARD_ISSUE_FEE_USD,
    feeFormatted: formatMoney(CARD_ISSUE_FEE_USD, "USD"),
  };
}

export async function initiateVirtualCardPurchase(input: {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  callbackUrl: string;
  label?: string;
}) {
  const existing = await listUserVirtualCards(input.userId);
  if (existing.length >= MAX_ACTIVE_CARDS) {
    throw new Error(
      `You can have up to ${MAX_ACTIVE_CARDS} active USD cards.`,
    );
  }

  const open = await getLatestOpenCardOrder(input.userId);
  if (open?.status === "paid_pending_review") {
    throw new Error(
      "Your card purchase is awaiting admin review. You’ll be notified when it’s issued.",
    );
  }

  if (!hasFlutterwaveKeys()) {
    throw new Error("Card purchase is not available right now.");
  }

  const localCurrency = currencyForCountry(input.countryCode).toUpperCase();
  const countryCode = resolveCountryCode(
    input.countryCode ?? countryFromCurrency(localCurrency),
  );
  const quote = await quoteLocalUsd(localCurrency);
  const feeUsd = Math.max(0.5, Number(CARD_ISSUE_FEE_USD) || 1.5);
  const localAmount = localToBuyUsd(feeUsd, quote.buyRate);
  const reference = `VC_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  // Reuse pending_payment order if one exists with same user
  let orderId: string;
  if (open?.status === "pending_payment" && open.id) {
    const [updated] = await db
      .update(usdVirtualCardOrders)
      .set({
        feeUsd: feeUsd.toFixed(2),
        localAmount: localAmount.toFixed(2),
        localCurrency,
        paymentRef: reference,
        metadata: {
          label: input.label?.trim() || null,
          buyRate: quote.buyRate,
          midRate: quote.midRate,
          provider: quote.provider,
        },
        updatedAt: new Date(),
      })
      .where(eq(usdVirtualCardOrders.id, open.id))
      .returning();
    orderId = updated.id;
  } else {
    const [created] = await db
      .insert(usdVirtualCardOrders)
      .values({
        userId: input.userId,
        feeUsd: feeUsd.toFixed(2),
        localAmount: localAmount.toFixed(2),
        localCurrency,
        status: "pending_payment",
        paymentRef: reference,
        metadata: {
          label: input.label?.trim() || null,
          buyRate: quote.buyRate,
          midRate: quote.midRate,
          provider: quote.provider,
        },
      })
      .returning();
    orderId = created.id;
  }

  const res = await flutterwaveFetch<InitCheckoutData>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: reference,
      amount: localAmount,
      currency: localCurrency,
      redirect_url: input.callbackUrl,
      payment_options: flutterwavePaymentOptions(countryCode),
      customer: {
        email: input.email,
        name: input.name || "ORYNO User",
        phonenumber: input.phone || undefined,
      },
      customizations: {
        title: "ORYNO",
        description: "USD virtual card purchase",
      },
      meta: {
        oryno_user_id: input.userId,
        purpose: "virtual_card_purchase",
        order_id: orderId,
        fee_usd: feeUsd,
        local_currency: localCurrency,
        local_amount: localAmount,
        country_code: countryCode,
      },
    }),
  });

  const authorizationUrl = res.data.link || res.data.authorization_url;
  if (!authorizationUrl) {
    throw new Error("Could not open the payment page. Try again.");
  }

  return {
    orderId,
    reference,
    authorizationUrl,
    feeUsd,
    feeFormatted: formatMoney(feeUsd, "USD"),
    localAmount,
    localCurrency,
    localFormatted: formatMoney(localAmount, localCurrency),
    demoMode: isFlutterwaveDemoMode(),
  };
}

export async function markVirtualCardOrderPaid(input: {
  reference: string;
  userId?: string | null;
}) {
  const order = await db.query.usdVirtualCardOrders.findFirst({
    where: eq(usdVirtualCardOrders.paymentRef, input.reference),
  });
  if (!order) throw new Error("Card purchase not found");
  if (input.userId && order.userId !== input.userId) {
    throw new Error("Purchase does not belong to this user");
  }

  if (
    order.status === "paid_pending_review" ||
    order.status === "approved" ||
    order.status === "issued"
  ) {
    return { duplicated: true as const, order: toOrderSummary(order) };
  }

  if (order.status === "rejected") {
    throw new Error("This purchase was rejected");
  }

  const [updated] = await db
    .update(usdVirtualCardOrders)
    .set({
      status: "paid_pending_review",
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(usdVirtualCardOrders.id, order.id))
    .returning();

  try {
    await createNotification({
      userId: order.userId,
      title: "Card payment received",
      body: "Your USD virtual card purchase is under review. We’ll notify you when it’s issued.",
      type: "system",
      metadata: { href: "/cards", purpose: "virtual_card_purchase" },
    });
  } catch (error) {
    console.error("[virtual-card-paid-notify]", error);
  }

  return { duplicated: false as const, order: toOrderSummary(updated) };
}

export async function verifyVirtualCardPurchase(input: {
  userId: string;
  reference?: string | null;
  transactionId?: string | number | null;
}) {
  type VerifyData = {
    status: string;
    tx_ref?: string;
    amount: number;
    currency: string;
    meta?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  };

  let reference = input.reference?.trim() || "";

  if (!hasFlutterwaveKeys()) {
    if (!reference) throw new Error("Missing payment reference");
    return markVirtualCardOrderPaid({
      reference,
      userId: input.userId,
    });
  }

  const res = input.transactionId
    ? await flutterwaveFetch<VerifyData>(
        `/transactions/${encodeURIComponent(String(input.transactionId))}/verify`,
      )
    : await flutterwaveFetch<VerifyData>(
        `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
      );

  if (!isPaymentSuccessful(res.data.status)) {
    throw new Error("Payment was not successful");
  }

  const meta = normalizeFlutterwaveMeta(res.data.meta ?? res.data.metadata) ?? {};
  const purpose = meta.purpose ?? meta.Purpose;
  if (purpose && purpose !== "virtual_card_purchase") {
    throw new Error("This payment is not a virtual card purchase");
  }

  const txRef = res.data.tx_ref || reference;
  if (!txRef) throw new Error("Missing payment reference");

  return markVirtualCardOrderPaid({
    reference: txRef,
    userId: input.userId,
  });
}

export async function listAdminVirtualCardOrders(limit = 80) {
  const rows = await db.query.usdVirtualCardOrders.findMany({
    orderBy: [desc(usdVirtualCardOrders.createdAt)],
    limit,
  });

  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userRows =
    userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, userIds),
        })
      : [];
  const byId = new Map(userRows.map((u) => [u.id, u]));

  return rows.map((row) => {
    const user = byId.get(row.userId);
    return {
      ...toOrderSummary(row),
      user: {
        id: row.userId,
        name: user?.fullName || "User",
        email: user?.email || "",
        countryCode: user?.countryCode || null,
      },
    };
  });
}

export async function reviewVirtualCardOrder(input: {
  orderId: string;
  adminUserId: string;
  action: "approve" | "reject";
  note?: string;
}) {
  const order = await db.query.usdVirtualCardOrders.findFirst({
    where: eq(usdVirtualCardOrders.id, input.orderId),
  });
  if (!order) throw new Error("Order not found");
  if (order.status !== "paid_pending_review") {
    throw new Error("Only paid orders awaiting review can be updated");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, order.userId),
  });
  if (!user) throw new Error("User not found");

  if (input.action === "reject") {
    const [updated] = await db
      .update(usdVirtualCardOrders)
      .set({
        status: "rejected",
        reviewedBy: input.adminUserId,
        reviewedAt: new Date(),
        reviewNote: input.note?.trim() || "Rejected by admin",
        updatedAt: new Date(),
      })
      .where(eq(usdVirtualCardOrders.id, order.id))
      .returning();

    try {
      await createNotification({
        userId: order.userId,
        title: "Card purchase rejected",
        body:
          input.note?.trim() ||
          "Your USD virtual card purchase was not approved. Contact support if you need help.",
        type: "system",
        metadata: { href: "/cards", purpose: "virtual_card_purchase" },
      });
    } catch (error) {
      console.error("[virtual-card-reject-notify]", error);
    }

    return { order: toOrderSummary(updated), card: null };
  }

  const issued = await issueVirtualCard({
    userId: order.userId,
    fullName: user.fullName,
    label:
      typeof order.metadata?.label === "string"
        ? order.metadata.label
        : undefined,
    orderId: order.id,
    paymentRef: order.paymentRef,
  });

  const [updated] = await db
    .update(usdVirtualCardOrders)
    .set({
      status: "issued",
      cardId: issued.card.id,
      reviewedBy: input.adminUserId,
      reviewedAt: new Date(),
      reviewNote: input.note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(usdVirtualCardOrders.id, order.id))
    .returning();

  try {
    await createNotification({
      userId: order.userId,
      title: "USD virtual card issued",
      body: `Your card ending in ${issued.card.last4} is ready. Open Cards to view details.`,
      type: "success",
      metadata: { href: "/cards", purpose: "virtual_card_purchase" },
    });
  } catch (error) {
    console.error("[virtual-card-approve-notify]", error);
  }

  return { order: toOrderSummary(updated), card: issued.card };
}

export async function setVirtualCardStatus(input: {
  userId: string;
  cardId: string;
  status: "active" | "frozen" | "terminated";
}) {
  const card = await db.query.usdVirtualCards.findFirst({
    where: and(
      eq(usdVirtualCards.id, input.cardId),
      eq(usdVirtualCards.userId, input.userId),
    ),
  });
  if (!card) throw new Error("Card not found");
  if (card.status === "terminated") {
    throw new Error("This card is terminated");
  }

  const [updated] = await db
    .update(usdVirtualCards)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(usdVirtualCards.id, card.id))
    .returning();

  return toSummary(updated);
}

export async function revealVirtualCard(input: {
  userId: string;
  cardId: string;
}) {
  const card = await db.query.usdVirtualCards.findFirst({
    where: and(
      eq(usdVirtualCards.id, input.cardId),
      eq(usdVirtualCards.userId, input.userId),
    ),
  });
  if (!card) throw new Error("Card not found");
  if (card.status === "terminated") {
    throw new Error("This card is terminated");
  }

  const pan = decryptSecret(card.panCipher);
  const cvv = decryptSecret(card.cvvCipher);

  return {
    ...toSummary(card),
    pan,
    panFormatted: formatPanGroups(pan),
    cvv,
    holderName: undefined as string | undefined,
  };
}

export async function getCardsPagePayload(userId: string, fullName: string) {
  const usd = await ensureUsdWallet(userId);
  const cards = await listUserVirtualCards(userId);
  const pendingOrder = await getLatestOpenCardOrder(userId);
  const { getUsdCardWaitlistStatus } = await import("@/lib/waitlist/usd-card");
  const waitlist = await getUsdCardWaitlistStatus(userId);
  return {
    issuer: USD_CARD_ISSUER,
    issueFeeUsd: CARD_ISSUE_FEE_USD,
    issueFeeFormatted: formatMoney(CARD_ISSUE_FEE_USD, "USD"),
    maxActiveCards: MAX_ACTIVE_CARDS,
    comingSoon: true,
    holderName: fullName,
    pendingOrder,
    waitlist,
    usd: {
      id: usd.id,
      balance: usd.balance,
      balanceFormatted: formatMoney(Number(usd.balance), "USD"),
      status: usd.status,
    },
    cards,
  };
}
