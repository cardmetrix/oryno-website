import {
  humanizeDepositReverseReason,
  humanizeWalletRefundReason,
  isProviderConfigError,
} from "@/lib/flutterwave/errors";

export class ReverseFailedError extends Error {
  status = 422;
  code = "reverse_failed" as const;
  constructor(message = "Could not reverse this transaction. Contact support.") {
    super(message);
    this.name = "ReverseFailedError";
  }
}

type RefundKind = "failed" | "reversed";

async function creditBack(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
  kind: RefundKind;
  userId?: string;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new ReverseFailedError("Invalid reverse amount");
  }

  return db.transaction(async (tx) => {
    const existing = await tx.query.transactions.findFirst({
      where: eq(transactions.id, input.transactionId),
    });
    if (!existing) {
      throw new ReverseFailedError("Original transaction not found");
    }
    if (input.kind === "failed" && existing.status === "completed") {
      return { ok: true as const, already: true as const };
    }

    const prev = (existing.metadata || {}) as Record<string, unknown>;
    if (prev.refundedAt || existing.status === "reversed") {
      return { ok: true as const, already: true as const };
    }
    if (input.kind === "failed" && existing.status === "failed" && prev.refundedAt) {
      return { ok: true as const, already: true as const };
    }

    const wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, input.walletId),
    });
    if (!wallet) {
      throw new ReverseFailedError("Wallet not found");
    }
    if (wallet.status === "closed") {
      await tx
        .update(transactions)
        .set({
          updatedAt: new Date(),
          metadata: {
            ...prev,
            reverseFailed: true,
            reverseFailureReason: "Wallet is closed",
          },
        })
        .where(eq(transactions.id, input.transactionId));
      throw new ReverseFailedError("Wallet is closed; reverse could not be applied");
    }

    const restored = (Number(wallet.balance) + input.amount).toFixed(2);
    await tx
      .update(wallets)
      .set({ balance: restored, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));

    const friendlyReason = humanizeWalletRefundReason(input.reason);
    const nextStatus = input.kind === "reversed" ? "reversed" : "failed";
    await tx
      .update(transactions)
      .set({
        status: nextStatus,
        updatedAt: new Date(),
        metadata: {
          ...prev,
          failureReason: input.reason,
          refundedAt: new Date().toISOString(),
          refundKind: input.kind,
          refundDestination: "wallet",
          providerConfigError: isProviderConfigError(input.reason),
        },
      })
      .where(eq(transactions.id, input.transactionId));

    await tx.insert(transactions).values({
      userId: input.userId || existing.userId,
      walletId: wallet.id,
      type: "credit",
      category: "refund",
      title:
        input.kind === "reversed"
          ? "Transaction reversed"
          : "Returned to wallet",
      subtitle: friendlyReason.slice(0, 255),
      amount: input.amount.toFixed(2),
      currency: existing.currency,
      status: "completed",
      balanceAfter: restored,
      relatedOrderId: existing.id,
      relatedOrderType: "transaction",
      externalRef: existing.externalRef,
      metadata: {
        originalTransactionId: existing.id,
        kind: input.kind,
        refundDestination: "wallet",
        providerConfigError: isProviderConfigError(input.reason),
      },
    });

    return { ok: true as const, already: false as const };
  });
}

/** Provider never fulfilled — restore the debit and mark the original failed. */
export async function refundFailedDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
  userId?: string;
}) {
  try {
    return await creditBack({ ...input, kind: "failed" });
  } catch (error) {
    console.error("[ledger-refund-failed]", error);
    throw error instanceof ReverseFailedError
      ? error
      : new ReverseFailedError(
          error instanceof Error ? error.message : "Refund failed",
        );
  }
}

/** Provider later reversed a successful debit — restore funds and mark reversed. */
export async function reverseCompletedDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
  userId?: string;
}) {
  try {
    return await creditBack({ ...input, kind: "reversed" });
  } catch (error) {
    console.error("[ledger-reverse]", error);
    throw error instanceof ReverseFailedError
      ? error
      : new ReverseFailedError(
          error instanceof Error ? error.message : "Reverse failed",
        );
  }
}

/** Provider (or other) clawed back a wallet credit (fund). */
export async function reverseCompletedCredit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
  userId?: string;
}) {
  return db.transaction(async (tx) => {
    const existing = await tx.query.transactions.findFirst({
      where: eq(transactions.id, input.transactionId),
    });
    if (!existing) throw new ReverseFailedError("Original credit not found");
    const prev = (existing.metadata || {}) as Record<string, unknown>;
    if (existing.status === "reversed" || prev.refundedAt) {
      return { ok: true as const, already: true as const };
    }

    const wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, input.walletId),
    });
    if (!wallet) throw new ReverseFailedError("Wallet not found");

    if (Number(wallet.balance) < input.amount) {
      await tx
        .update(transactions)
        .set({
          updatedAt: new Date(),
          metadata: {
            ...prev,
            reverseFailed: true,
            reverseFailureReason: "Insufficient balance to claw back funding",
          },
        })
        .where(eq(transactions.id, input.transactionId));
      throw new ReverseFailedError(
        "Funding reverse failed: wallet balance is lower than the deposit",
      );
    }

    const next = (Number(wallet.balance) - input.amount).toFixed(2);
    await tx
      .update(wallets)
      .set({ balance: next, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));

    await tx
      .update(transactions)
      .set({
        status: "reversed",
        updatedAt: new Date(),
        metadata: {
          ...prev,
          failureReason: input.reason,
          refundedAt: new Date().toISOString(),
          refundKind: "reversed",
        },
      })
      .where(eq(transactions.id, input.transactionId));

    await tx.insert(transactions).values({
      userId: input.userId || existing.userId,
      walletId: wallet.id,
      type: "debit",
      category: "refund",
      title: "Deposit reversed",
      subtitle: humanizeDepositReverseReason(input.reason).slice(0, 255),
      amount: input.amount.toFixed(2),
      currency: existing.currency,
      status: "completed",
      balanceAfter: next,
      relatedOrderId: existing.id,
      relatedOrderType: "transaction",
      externalRef: existing.externalRef,
      metadata: {
        originalTransactionId: existing.id,
        kind: "reversed",
      },
    });

    return { ok: true as const, already: false as const };
  });
}
