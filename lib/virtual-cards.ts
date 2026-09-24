import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { usdVirtualCards } from "@/lib/db/schema";
import { USD_CARD_ISSUER } from "@/lib/support/config";
import { debitUsdWallet, ensureUsdWallet } from "@/lib/wallet-usd";
import { formatMoney } from "@/lib/transactions";

export const CARD_ISSUE_FEE_USD = Number(
  process.env.USD_VIRTUAL_CARD_FEE || "1.5",
);
export const MAX_ACTIVE_CARDS = 3;

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

export async function issueVirtualCard(input: {
  userId: string;
  fullName: string;
  label?: string;
}) {
  const existing = await listUserVirtualCards(input.userId);
  if (existing.length >= MAX_ACTIVE_CARDS) {
    throw new Error(
      `You can have up to ${MAX_ACTIVE_CARDS} active USD cards. Freeze or terminate one first.`,
    );
  }

  const usdWallet = await ensureUsdWallet(input.userId);
  const fee = Math.max(0, Number(CARD_ISSUE_FEE_USD) || 0);

  let feeTxId: string | null = null;
  if (fee > 0) {
    const debit = await debitUsdWallet({
      userId: input.userId,
      amount: fee,
      category: "fee",
      title: "USD virtual card fee",
      subtitle: `${USD_CARD_ISSUER} issuance`,
      metadata: { purpose: "virtual_card_issue" },
    });
    feeTxId = debit.transaction.id;
    // Mark completed immediately for fee
    const { transactions } = await import("@/lib/db/schema");
    await db
      .update(transactions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(transactions.id, debit.transaction.id));
  }

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
      metadata: {
        issuer: USD_CARD_ISSUER,
        feeUsd: fee,
        feeTransactionId: feeTxId,
      },
    })
    .returning();

  return {
    card: toSummary(created),
    feeUsd: fee,
    feeFormatted: formatMoney(fee, "USD"),
    feeTransactionId: feeTxId,
  };
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
  return {
    issuer: USD_CARD_ISSUER,
    issueFeeUsd: CARD_ISSUE_FEE_USD,
    issueFeeFormatted: formatMoney(CARD_ISSUE_FEE_USD, "USD"),
    maxActiveCards: MAX_ACTIVE_CARDS,
    holderName: fullName,
    usd: {
      id: usd.id,
      balance: usd.balance,
      balanceFormatted: formatMoney(Number(usd.balance), "USD"),
      status: usd.status,
    },
    cards,
  };
}
