import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions, wallets } from "@/lib/db/schema";
import { ensurePrimaryWallet, toWalletSummary } from "@/lib/wallet";

/**
 * Credit airtime cashback to the user's wallet and create a ledger transaction.
 * Idempotent per purchase transaction id.
 */
export async function creditAirtimeCashback(input: {
  userId: string;
  walletId: string;
  currency: string;
  amount: number;
  /** Original airtime debit transaction id (idempotency key). */
  purchaseTransactionId: string;
  phone?: string | null;
  networkName?: string | null;
}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const existing = await db.query.transactions.findFirst({
    where: and(
      eq(transactions.userId, input.userId),
      eq(transactions.category, "cashback"),
      eq(transactions.relatedOrderId, input.purchaseTransactionId),
    ),
    columns: { id: true },
  });
  if (existing) return { already: true as const, transactionId: existing.id };

  const amountStr = amount.toFixed(2);
  const network = input.networkName?.trim() || "Airtime";
  const phone = input.phone?.trim();

  const result = await db.transaction(async (tx) => {
    let wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, input.walletId),
    });

    if (!wallet) {
      wallet = await ensurePrimaryWallet(input.userId, input.currency);
    }
    if (!wallet) throw new Error("Wallet not found for cashback");
    if (wallet.status === "closed") {
      throw new Error("Wallet is closed; cashback could not be applied");
    }

    // Re-check idempotency inside the transaction.
    const dup = await tx.query.transactions.findFirst({
      where: and(
        eq(transactions.userId, input.userId),
        eq(transactions.category, "cashback"),
        eq(transactions.relatedOrderId, input.purchaseTransactionId),
      ),
      columns: { id: true },
    });
    if (dup) return { already: true as const, transactionId: dup.id, wallet };

    const nextBalance = (Number(wallet.balance) + amount).toFixed(2);

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: wallet.id,
        type: "credit",
        category: "cashback",
        title: "Airtime cashback",
        subtitle: phone ? `${network} · ${phone}` : network,
        amount: amountStr,
        currency: wallet.currency || input.currency,
        status: "completed",
        balanceAfter: nextBalance,
        relatedOrderId: input.purchaseTransactionId,
        relatedOrderType: "transaction",
        metadata: {
          kind: "airtime_cashback",
          purchaseTransactionId: input.purchaseTransactionId,
          network: network,
          phone: phone || null,
        },
      })
      .returning();

    const [updated] = await tx
      .update(wallets)
      .set({ balance: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();

    return {
      already: false as const,
      transactionId: txRow.id,
      wallet: updated ?? { ...wallet, balance: nextBalance },
    };
  });

  return result;
}

/** Best-effort cashback credit — never fails the airtime purchase. */
export async function maybeCreditAirtimeCashback(input: {
  userId: string;
  walletId: string;
  currency: string;
  amount: number;
  purchaseTransactionId: string;
  phone?: string | null;
  networkName?: string | null;
}) {
  if (!input.amount || input.amount <= 0) return null;
  try {
    const credited = await creditAirtimeCashback(input);
    if (!credited || credited.already || !("wallet" in credited)) {
      return credited;
    }
    return {
      ...credited,
      walletSummary: toWalletSummary(credited.wallet),
    };
  } catch (error) {
    console.error("[airtime-cashback]", error);
    return null;
  }
}
