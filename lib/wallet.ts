import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  userBankAccounts,
  walletFundings,
  wallets,
  withdrawals,
} from "@/lib/db/schema";
import {
  formatMoney,
  toAppTransaction,
  type AppTransaction,
} from "@/lib/transactions";
import {
  currencyForCountry as currencyFromCountryLib,
  resolveCountryCode,
} from "@/lib/country";
import {
  convertLocalToNgn,
  type NgnLocalQuote,
} from "@/lib/fx/rates";
import { getDisplayFx } from "@/lib/display-currency";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import { humanizeFlutterwaveTransferError, humanizeWalletRefundReason } from "@/lib/flutterwave/errors";
import type {
  BankAccountSummary,
  FundingMethod,
  WalletSummary,
} from "@/lib/wallet-types";

export type {
  BankAccountSummary,
  FundingMethod,
  WalletSummary,
} from "@/lib/wallet-types";
export { DEMO_BANKS } from "@/lib/wallet-types";

export type WalletRow = typeof wallets.$inferSelect;
export type BankAccountRow = typeof userBankAccounts.$inferSelect;

export function currencyForCountry(countryCode?: string | null) {
  return currencyFromCountryLib(countryCode);
}

export function maskAccountNumber(accountNumber: string) {
  const digits = accountNumber.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

/** Stable unique 10-digit ORYNO card number from user + currency. */
export function generateWalletCardNumber(userId: string, currency = "NGN") {
  const seed = `${userId}:${currency}:oryno-card`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(hash, 131) + seed.charCodeAt(i)) >>> 0;
  }
  const body = String(1_000_000_000 + (hash % 900_000_000)).slice(0, 10);
  // Prefix 80 = ORYNO virtual card BIN-style marker
  return `80${body.slice(0, 8)}`.slice(0, 10);
}

export function formatCardDisplay(cardNumber: string, hidden = false) {
  const digits = cardNumber.replace(/\D/g, "").padStart(10, "0").slice(-10);
  if (hidden) return "••••  ••••  ••••  ••••";
  return `${digits.slice(0, 4)}  ${digits.slice(4, 8)}  ${digits.slice(8)}`;
}

export function toWalletSummary(
  wallet: WalletRow,
  _fx?: NgnLocalQuote | null,
): WalletSummary {
  // Phase 1: balances are stored in true wallet currency (local + USD).
  // Do not FX-convert NGN → local for display.
  void _fx;
  const cardNumber =
    wallet.cardNumber || generateWalletCardNumber(wallet.userId, wallet.currency);
  const balanceValue = Number(wallet.balance);
  const currency = wallet.currency;
  return {
    id: wallet.id,
    currency,
    balance: Number.isFinite(balanceValue) ? balanceValue.toFixed(2) : wallet.balance,
    balanceFormatted: formatMoney(balanceValue, currency),
    status: wallet.status,
    isPrimary: wallet.isPrimary,
    dailyLimit: wallet.dailyLimit,
    cardNumber,
    cardNumberMasked: maskAccountNumber(cardNumber),
  };
}

async function issueCardNumber(wallet: WalletRow): Promise<WalletRow> {
  if (wallet.cardNumber) return wallet;
  const cardNumber = generateWalletCardNumber(wallet.userId, wallet.currency);
  try {
    const [updated] = await db
      .update(wallets)
      .set({ cardNumber, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id))
      .returning();
    return updated ?? { ...wallet, cardNumber };
  } catch {
    try {
      // Unique collision — append random suffix digits
      const fallback = `${cardNumber.slice(0, 8)}${Math.floor(10 + Math.random() * 89)}`;
      const [updated] = await db
        .update(wallets)
        .set({ cardNumber: fallback, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id))
        .returning();
      return updated ?? { ...wallet, cardNumber: fallback };
    } catch {
      // Schema/connection issues — still return a display number
      return { ...wallet, cardNumber };
    }
  }
}

export function toBankSummary(account: BankAccountRow): BankAccountSummary {
  return {
    id: account.id,
    bankName: account.bankName,
    bankCode: account.bankCode,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    isPrimary: account.isPrimary,
    verified: account.verified,
    maskedNumber: maskAccountNumber(account.accountNumber),
  };
}

export async function ensurePrimaryWallet(
  userId: string,
  currency = "NGN",
): Promise<WalletRow> {
  const existing = await db.query.wallets.findFirst({
    where: and(eq(wallets.userId, userId), eq(wallets.currency, currency)),
  });

  if (existing) {
    if (!existing.isPrimary) {
      // Demote others first, then promote — order avoids brief "no primary" races
      await db
        .update(wallets)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(
          and(
            eq(wallets.userId, userId),
            eq(wallets.isPrimary, true),
          ),
        );
      const [updated] = await db
        .update(wallets)
        .set({ isPrimary: true, updatedAt: new Date() })
        .where(eq(wallets.id, existing.id))
        .returning();
      return issueCardNumber(updated ?? { ...existing, isPrimary: true });
    }
    return issueCardNumber(existing);
  }

  const cardNumber = generateWalletCardNumber(userId, currency);

  // Soft-demote before insert so new wallet can be primary
  await db
    .update(wallets)
    .set({ isPrimary: false, updatedAt: new Date() })
    .where(and(eq(wallets.userId, userId), eq(wallets.isPrimary, true)));

  try {
    const [created] = await db
      .insert(wallets)
      .values({
        userId,
        currency,
        balance: "0",
        isPrimary: true,
        cardNumber,
      })
      .onConflictDoNothing()
      .returning();

    if (created) return issueCardNumber(created);
  } catch (error) {
    // Unique card_number collision — retry with random suffix
    console.error("[ensure-primary-wallet-insert]", error);
    const fallback = `${cardNumber.slice(0, 8)}${Math.floor(10 + Math.random() * 89)}`;
    const [created] = await db
      .insert(wallets)
      .values({
        userId,
        currency,
        balance: "0",
        isPrimary: true,
        cardNumber: fallback,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return issueCardNumber(created);
  }

  const again = await db.query.wallets.findFirst({
    where: and(eq(wallets.userId, userId), eq(wallets.currency, currency)),
  });
  if (!again) throw new Error("Unable to create wallet");

  if (!again.isPrimary) {
    await db
      .update(wallets)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(eq(wallets.userId, userId), eq(wallets.isPrimary, true)));
    const [updated] = await db
      .update(wallets)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(eq(wallets.id, again.id))
      .returning();
    return issueCardNumber(updated ?? { ...again, isPrimary: true });
  }

  return issueCardNumber(again);
}

export async function listUserWallets(userId: string) {
  return db.query.wallets.findMany({
    where: eq(wallets.userId, userId),
    orderBy: [desc(wallets.isPrimary), desc(wallets.updatedAt)],
  });
}

export async function listBankAccounts(userId: string) {
  return db
    .select()
    .from(userBankAccounts)
    .where(eq(userBankAccounts.userId, userId))
    .orderBy(
      desc(userBankAccounts.isPrimary),
      desc(userBankAccounts.createdAt),
    );
}

export async function recentWalletTransactions(
  userId: string,
  limit = 8,
  fx?: NgnLocalQuote | null,
): Promise<AppTransaction[]> {
  const rows = await db.query.transactions.findMany({
    where: eq(transactions.userId, userId),
    orderBy: [desc(transactions.createdAt)],
    limit,
  });

  return rows.map((row) => toAppTransaction(row, fx));
}

function assertHealthy(wallet: WalletRow) {
  if (wallet.status === "frozen") {
    throw new Error("Wallet is frozen. Contact support.");
  }
  if (wallet.status === "closed") {
    throw new Error("Wallet is closed.");
  }
}

function parseAmount(raw: string | number) {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return Math.round(value * 100) / 100;
}

export async function fundWallet(input: {
  userId: string;
  amount: string | number;
  method: FundingMethod;
  currency?: string;
  countryCode?: string | null;
}) {
  const allowSim =
    (process.env.ALLOW_SIMULATED_FUND || "").trim().toLowerCase() === "true" ||
    (process.env.ALLOW_SIMULATED_FUND || "").trim() === "1";
  if (!allowSim) {
    throw new Error(
      "Direct wallet credit is disabled. Fund via deposit or checkout, or set ALLOW_SIMULATED_FUND=true for local testing only.",
    );
  }

  const currency =
    input.currency ?? currencyForCountry(input.countryCode);
  const amount = parseAmount(input.amount);
  const amountStr = amount.toFixed(2);

  return db.transaction(async (tx) => {
    let wallet = await tx.query.wallets.findFirst({
      where: and(
        eq(wallets.userId, input.userId),
        eq(wallets.currency, currency),
      ),
    });

    if (!wallet) {
      const [created] = await tx
        .insert(wallets)
        .values({
          userId: input.userId,
          currency,
          balance: "0",
          isPrimary: true,
          cardNumber: generateWalletCardNumber(input.userId, currency),
        })
        .returning();
      wallet = created;
    }

    assertHealthy(wallet);

    const nextBalance = (Number(wallet.balance) + amount).toFixed(2);
    const methodLabel =
      input.method === "bank_transfer"
        ? "Bank transfer"
        : input.method === "ussd"
          ? "USSD"
          : input.method === "mobile_money"
            ? "Mobile money"
            : "Card";

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: wallet.id,
        type: "credit",
        category: "fund",
        title: "Wallet funded",
        subtitle: `${methodLabel} top-up`,
        amount: amountStr,
        currency,
        status: "completed",
        balanceAfter: nextBalance,
        metadata: { method: input.method },
      })
      .returning();

    const [updated] = await tx
      .update(wallets)
      .set({
        balance: nextBalance,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id))
      .returning();

    const [funding] = await tx
      .insert(walletFundings)
      .values({
        userId: input.userId,
        walletId: wallet.id,
        amount: amountStr,
        currency,
        method: input.method,
        status: "completed",
        externalRef: `FND-${Date.now().toString(36).toUpperCase()}`,
        transactionId: txRow.id,
        metadata: { simulated: true },
      })
      .returning();

    return {
      funding,
      transaction: txRow,
      wallet: updated ?? { ...wallet, balance: nextBalance },
    };
  }).then(async (result) => {
    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);
    return result;
  });
}

export async function withdrawWallet(input: {
  userId: string;
  amount: string | number;
  bankAccountId: string;
  countryCode?: string | null;
  currency?: string;
  fee?: number;
}) {
  const { sendFlutterwaveWithdrawal } = await import("@/lib/flutterwave/transfers");
  const { ensureWalletSchema } = await import("@/lib/db/ensure-schema");
  await ensureWalletSchema();

  const countryCode = resolveCountryCode(input.countryCode);
  const payoutCurrency = currencyForCountry(countryCode);
  const localAmount = parseAmount(input.amount);
  const {
    assertWithdrawMinimum,
    getWithdrawMinimum,
  } = await import("@/lib/wallet/withdraw-limits");
  const minWithdraw = await getWithdrawMinimum(countryCode);
  assertWithdrawMinimum({
    localAmount,
    minLocal: minWithdraw.minLocal,
    message: minWithdraw.message,
  });
  const fx = await getDisplayFx(countryCode);
  const ledgerNgn =
    payoutCurrency === "NGN"
      ? localAmount
      : convertLocalToNgn(localAmount, fx.localToNgn);
  const { assertDailyTransactionLimit } = await import(
    "@/lib/wallet/daily-limit"
  );
  await assertDailyTransactionLimit({
    userId: input.userId,
    amountNgn: ledgerNgn,
    countryCode,
  });
  const fee = Math.max(0, Number(input.fee ?? 0));
  const ledgerTotal = Math.round((ledgerNgn + fee) * 100) / 100;
  const amountStr = ledgerNgn.toFixed(2);
  const localAmountStr = localAmount.toFixed(2);
  const feeStr = fee.toFixed(2);
  const reference = `WDR_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

  const prepared = await db.transaction(async (tx) => {
    const bank = await tx.query.userBankAccounts.findFirst({
      where: and(
        eq(userBankAccounts.id, input.bankAccountId),
        eq(userBankAccounts.userId, input.userId),
      ),
    });
    if (!bank) throw new Error("Bank account not found.");
    if (!bank.bankCode) {
      throw new Error("Re-add this bank account so we can verify it.");
    }

    const wallet = await tx.query.wallets.findFirst({
      where: and(
        eq(wallets.userId, input.userId),
        eq(wallets.currency, "NGN"),
      ),
    });
    if (!wallet) throw new Error("Wallet not found.");
    assertHealthy(wallet);

    if (Number(wallet.balance) < ledgerTotal) {
      throw new Error("Insufficient wallet balance.");
    }

    const nextBalance = (Number(wallet.balance) - ledgerTotal).toFixed(2);

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: wallet.id,
        type: "debit",
        category: "withdraw",
        title: "Withdrawal",
        subtitle:
          fee > 0
            ? `${bank.bankName} · ${maskAccountNumber(bank.accountNumber)} · Fee ₦${feeStr}`
            : `${bank.bankName} · ${maskAccountNumber(bank.accountNumber)}`,
        amount: amountStr,
        currency: "NGN",
        status: "processing",
        balanceAfter: nextBalance,
        externalRef: reference,
        metadata: {
          fee: feeStr,
          bankAccountId: bank.id,
          reference,
          localAmount: localAmountStr,
          payoutCurrency,
          countryCode,
        },
      })
      .returning();

    const [updated] = await tx
      .update(wallets)
      .set({
        balance: nextBalance,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id))
      .returning();

    const [withdrawal] = await tx
      .insert(withdrawals)
      .values({
        userId: input.userId,
        walletId: wallet.id,
        bankAccountId: bank.id,
        amount: amountStr,
        fee: feeStr,
        currency: "NGN",
        countryCode,
        status: "processing",
        providerRef: reference,
        transactionId: txRow.id,
      })
      .returning();

    return {
      withdrawal,
      transaction: txRow,
      wallet: updated ?? { ...wallet, balance: nextBalance },
      bank,
      nextBalance,
    };
  });

  try {
    const payout = await sendFlutterwaveWithdrawal({
      bank: prepared.bank,
      amount: localAmount,
      currency: payoutCurrency,
      reference,
      countryCode,
    });

    const transferStatus = payout.transfer.status;
    if (transferStatus === "failed" || transferStatus === "reversed") {
      throw new Error("Flutterwave could not send this withdrawal to the bank.");
    }

    // Only complete after Flutterwave confirms a successful bank transfer.
    // Demo mode still waits for that confirmation so we never mark complete without a payout.
    const nextWithdrawalStatus =
      transferStatus === "success"
        ? ("completed" as const)
        : ("sent_to_provider" as const);
    const nextTxStatus =
      nextWithdrawalStatus === "completed"
        ? ("completed" as const)
        : ("processing" as const);

    const [withdrawal] = await db
      .update(withdrawals)
      .set({
        status: nextWithdrawalStatus,
        processedAt:
          nextWithdrawalStatus === "completed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, prepared.withdrawal.id))
      .returning();

    const [txRow] = await db
      .update(transactions)
      .set({
        status: nextTxStatus,
        updatedAt: new Date(),
        metadata: {
          fee: feeStr,
          bankAccountId: prepared.bank.id,
          reference,
          flutterwaveTransferId: payout.transfer.transferCode,
          simulated: Boolean(payout.simulated),
          transferStatus: payout.transfer.status,
          localAmount: localAmountStr,
          payoutCurrency,
          countryCode,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id))
      .returning();

    if (nextWithdrawalStatus === "completed" && fee > 0) {
      try {
        const { recognizeNgnServiceProfit } = await import(
          "@/lib/company/recognize"
        );
        await recognizeNgnServiceProfit({
          source: "withdraw",
          transactionId: prepared.transaction.id,
          userId: input.userId,
          grossIn: fee,
          grossOut: 0,
          chargeAmount: fee,
          description: "Withdrawal fee",
          metadata: { reference, localAmount, countryCode },
        });
      } catch (revenueError) {
        console.error("[withdraw-fee-revenue]", revenueError);
      }
    }

    return {
      withdrawal: withdrawal ?? prepared.withdrawal,
      transaction: txRow ?? prepared.transaction,
      wallet: prepared.wallet,
      bank: prepared.bank,
      pending: nextWithdrawalStatus !== "completed",
      localAmount,
      payoutCurrency,
      countryCode,
    };
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "Withdrawal transfer failed";
    const { hasFlutterwaveProxy, flutterwaveProxyHost } = await import(
      "@/lib/flutterwave/http"
    );
    console.error("[withdraw-flutterwave]", {
      reference,
      userId: input.userId,
      proxy: hasFlutterwaveProxy()
        ? flutterwaveProxyHost() || "configured"
        : "missing",
      error: raw,
    });

    try {
      await refundFailedDebit({
        walletId: prepared.wallet.id,
        transactionId: prepared.transaction.id,
        amount: ledgerTotal,
        reason: humanizeWalletRefundReason(raw),
        userId: input.userId,
      });
    } catch (refundError) {
      console.error("[withdraw-refund]", refundError);
    }

    await db
      .update(withdrawals)
      .set({
        status: "failed",
        failureReason: raw,
        processedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(withdrawals.id, prepared.withdrawal.id));

    throw new Error(humanizeFlutterwaveTransferError(raw));
  }
}
