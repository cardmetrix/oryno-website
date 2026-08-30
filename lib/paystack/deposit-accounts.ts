import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  userDepositAccounts,
  users,
  walletFundings,
  wallets,
} from "@/lib/db/schema";
import { createNotification } from "@/lib/notifications-service";
import {
  currencyForCountry,
  formatCountryMoney,
  resolveCountryCode,
} from "@/lib/country";
import { convertLocalToNgn } from "@/lib/fx/rates";
import { ensurePrimaryWallet, toWalletSummary } from "@/lib/wallet";
import {
  countryFromCurrency,
  fundPresetsForCountry,
} from "@/lib/paystack/country";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
  paystackFetch,
} from "@/lib/paystack/client";

export type DepositAccountDto = {
  id: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankSlug: string | null;
  currency: string;
  provider: string;
  status: string;
  demoMode: boolean;
  instructions: string;
};

function toDto(
  row: typeof userDepositAccounts.$inferSelect,
): DepositAccountDto {
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    bankName: row.bankName,
    bankSlug: row.bankSlug,
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    demoMode: isPaystackDemoMode(),
    instructions:
      "Transfer any amount to this account. Your ORYNO wallet is credited automatically after Paystack confirms the payment.",
  };
}

function demoAccountNumber(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(hash, 131) + userId.charCodeAt(i)) >>> 0;
  }
  const body = String(1_000_000_000 + (hash % 900_000_000)).slice(0, 10);
  return body;
}

async function createDemoDepositAccount(user: typeof users.$inferSelect) {
  const accountNumber = demoAccountNumber(user.id);
  const [created] = await db
    .insert(userDepositAccounts)
    .values({
      userId: user.id,
      provider: "paystack_demo",
      currency: "NGN",
      accountNumber,
      accountName: user.fullName.toUpperCase(),
      bankName: "Paystack-Titan",
      bankSlug: "titan-paystack",
      paystackCustomerCode: `DEMO_${user.id.slice(0, 8)}`,
      status: "active",
      metadata: { mode: "demo", source: "local_fallback" },
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, user.id),
  });
  if (!existing) throw new Error("Unable to create demo deposit account");
  return existing;
}

type PaystackCustomer = {
  id: number;
  customer_code: string;
  email: string;
};

type PaystackDedicatedAccount = {
  id: number;
  account_number: string;
  account_name: string;
  currency: string;
  bank: { name: string; slug: string; id?: number };
  customer?: { customer_code?: string; id?: number };
};

async function ensurePaystackCustomer(user: typeof users.$inferSelect) {
  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, user.id),
  });
  if (existing?.paystackCustomerCode?.startsWith("CUS_")) {
    return existing.paystackCustomerCode;
  }

  const created = await paystackFetch<PaystackCustomer>("/customer", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      first_name: user.fullName.split(" ")[0] || "ORYNO",
      last_name: user.fullName.split(" ").slice(1).join(" ") || "User",
      phone: user.phone || undefined,
      metadata: { oryno_user_id: user.id },
    }),
  });

  return created.data.customer_code;
}

async function createPaystackDepositAccount(user: typeof users.$inferSelect) {
  const customerCode = await ensurePaystackCustomer(user);
  const preferredBank =
    process.env.PAYSTACK_DVA_BANK?.trim() || "wema-bank";

  try {
    const created = await paystackFetch<PaystackDedicatedAccount>(
      "/dedicated_account",
      {
        method: "POST",
        body: JSON.stringify({
          customer: customerCode,
          preferred_bank: preferredBank,
          first_name: user.fullName.split(" ")[0] || "ORYNO",
          last_name: user.fullName.split(" ").slice(1).join(" ") || "User",
          phone: user.phone || undefined,
        }),
      },
    );

    const data = created.data;
    const [row] = await db
      .insert(userDepositAccounts)
      .values({
        userId: user.id,
        provider: "paystack",
        currency: (data.currency || "NGN").toUpperCase(),
        accountNumber: data.account_number,
        accountName: data.account_name,
        bankName: data.bank?.name || "Paystack",
        bankSlug: data.bank?.slug || preferredBank,
        paystackCustomerCode: customerCode,
        paystackAccountId: String(data.id),
        status: "active",
        metadata: { mode: isPaystackDemoMode() ? "test" : "live", raw: data },
      })
      .onConflictDoNothing()
      .returning();

    if (row) return row;

    const existing = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.userId, user.id),
    });
    if (!existing) throw new Error("Unable to save Paystack deposit account");
    return existing;
  } catch (error) {
    console.error("[paystack-dva-create]", error);
    // Test accounts / unfinished compliance often fail — fall back to demo DVA
    return createDemoDepositAccount(user);
  }
}

export async function getOrCreateDepositAccount(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) throw new Error("User not found");

  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, userId),
  });
  if (existing) return toDto(existing);

  const created = hasPaystackKeys()
    ? await createPaystackDepositAccount(user)
    : await createDemoDepositAccount(user);

  return toDto(created);
}

export async function creditWalletFromDeposit(input: {
  userId: string;
  amountKobo: number;
  currency?: string;
  reference: string;
  channel?: string;
  paidAt?: string;
  raw?: Record<string, unknown>;
}) {
  if (!input.reference) throw new Error("Missing payment reference");
  if (!Number.isFinite(input.amountKobo) || input.amountKobo <= 0) {
    throw new Error("Invalid deposit amount");
  }

  const paidLocal = input.amountKobo / 100;
  const paidCurrency = (input.currency || "NGN").toUpperCase();
  const paidCountry = countryFromCurrency(paidCurrency);
  let ledgerNgn = paidLocal;
  if (paidCurrency !== "NGN") {
    const { getDisplayFx } = await import("@/lib/display-currency");
    const fx = await getDisplayFx(paidCountry);
    ledgerNgn = convertLocalToNgn(paidLocal, fx.localToNgn);
  }
  const amount = ledgerNgn.toFixed(2);
  const currency = "NGN";

  const already = await db.query.walletFundings.findFirst({
    where: eq(walletFundings.externalRef, input.reference),
  });
  if (already) {
    return { duplicated: true as const, fundingId: already.id };
  }

  const wallet = await ensurePrimaryWallet(input.userId, "NGN");

  const result = await db.transaction(async (tx) => {
    const current = await tx.query.wallets.findFirst({
      where: and(eq(wallets.id, wallet.id), eq(wallets.userId, input.userId)),
    });
    if (!current) throw new Error("Wallet not found");

    const nextBalance = (Number(current.balance) + Number(amount)).toFixed(2);

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: current.id,
        type: "credit",
        category: "fund",
        title: "Wallet funded",
        subtitle: "Paystack deposit",
        amount,
        currency,
        status: "completed",
        balanceAfter: nextBalance,
        externalRef: input.reference,
        metadata: {
          channel: input.channel ?? "bank_transfer",
          provider: "paystack",
          paidAt: input.paidAt,
          paidLocal,
          paidCurrency,
        },
      })
      .returning();

    const [updatedWallet] = await tx
      .update(wallets)
      .set({ balance: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, current.id))
      .returning();

    const [funding] = await tx
      .insert(walletFundings)
      .values({
        userId: input.userId,
        walletId: current.id,
        amount,
        currency,
        method: "bank_transfer",
        status: "completed",
        externalRef: input.reference,
        transactionId: txRow.id,
        metadata: {
          provider: "paystack",
          channel: input.channel ?? "dedicated_nuban",
          paidLocal,
          paidCurrency,
          raw: input.raw ?? null,
        },
      })
      .returning();

    return {
      funding,
      transaction: txRow,
      wallet: updatedWallet ?? { ...current, balance: nextBalance },
    };
  });

  const { scheduleReferralCheck } = await import("@/lib/referrals/service");
  scheduleReferralCheck(input.userId);

  const amountFormatted = formatCountryMoney(paidLocal, paidCountry);
  const { getDisplayFx } = await import("@/lib/display-currency");
  const fx = await getDisplayFx(paidCountry);

  try {
    await createNotification({
      userId: input.userId,
      title: "Wallet funded",
      body: `${amountFormatted} received via Paystack. Ref ${input.reference}`,
      type: "fund",
      metadata: {
        href: "/wallet",
        fundingId: result.funding.id,
        transactionId: result.transaction.id,
      },
    });
  } catch (notifyError) {
    console.error("[paystack-deposit-notify]", notifyError);
  }

  return {
    duplicated: false as const,
    fundingId: result.funding.id,
    transactionId: result.transaction.id,
    wallet: toWalletSummary(result.wallet, fx),
    amountFormatted,
    reference: input.reference,
  };
}

export type WalletFundMethod = "dva" | "checkout";

export async function getWalletFundOptions(user: typeof users.$inferSelect) {
  const countryCode = resolveCountryCode(user.countryCode);
  const currency = currencyForCountry(countryCode);
  const presets = fundPresetsForCountry(countryCode);
  const demoMode = isPaystackDemoMode();
  const account = await getOrCreateDepositAccount(user.id);

  return {
    method: "dva" as const,
    countryCode,
    currency,
    presets,
    account,
    demoMode,
  };
}

export async function reversePaystackDeposit(input: {
  reference: string;
  reason: string;
}) {
  if (!input.reference) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const funding = await db.query.walletFundings.findFirst({
    where: eq(walletFundings.externalRef, input.reference),
  });
  if (!funding?.transactionId) {
    return { ok: false as const, reason: "not_found" as const };
  }
  if (funding.status === "reversed" || funding.status === "failed") {
    return {
      ok: true as const,
      already: true as const,
      status: funding.status,
    };
  }

  const { reverseCompletedCredit, ReverseFailedError } = await import(
    "@/lib/wallet/ledger"
  );

  try {
    const result = await reverseCompletedCredit({
      walletId: funding.walletId,
      transactionId: funding.transactionId,
      amount: Number(funding.amount),
      reason: input.reason,
      userId: funding.userId,
    });

    await db
      .update(walletFundings)
      .set({
        status: "reversed",
        updatedAt: new Date(),
        metadata: {
          ...(funding.metadata ?? {}),
          reversedAt: new Date().toISOString(),
          reverseReason: input.reason,
        },
      })
      .where(eq(walletFundings.id, funding.id));

    try {
      await createNotification({
        userId: funding.userId,
        title: result.already ? "Deposit already reversed" : "Deposit reversed",
        body: result.already
          ? "This Paystack deposit was already reversed."
          : "A Paystack deposit was reversed and deducted from your wallet.",
        type: "fund",
        metadata: {
          href: "/wallet",
          fundingId: funding.id,
          transactionId: funding.transactionId,
        },
      });
    } catch (notifyError) {
      console.error("[paystack-deposit-reverse-notify]", notifyError);
    }

    return {
      ok: true as const,
      already: result.already,
      status: "reversed" as const,
    };
  } catch (error) {
    console.error("[paystack-deposit-reverse]", error);
    await db
      .update(walletFundings)
      .set({
        updatedAt: new Date(),
        metadata: {
          ...(funding.metadata ?? {}),
          reverseFailed: true,
          reverseFailureReason:
            error instanceof Error ? error.message : "Reverse failed",
        },
      })
      .where(eq(walletFundings.id, funding.id));
    throw error instanceof ReverseFailedError
      ? error
      : new ReverseFailedError(
          error instanceof Error ? error.message : "Deposit reverse failed",
        );
  }
}

export async function findUserIdForPaystackCharge(data: {
  customer?: { customer_code?: string; email?: string };
  authorization?: { receiver_bank_account_number?: string };
  metadata?: Record<string, unknown> | null;
}) {
  const customerCode = data.customer?.customer_code;
  if (customerCode) {
    const byCustomer = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.paystackCustomerCode, customerCode),
    });
    if (byCustomer) return byCustomer.userId;
  }

  const accountNumber = data.authorization?.receiver_bank_account_number;
  if (accountNumber) {
    const byAccount = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.accountNumber, accountNumber),
    });
    if (byAccount) return byAccount.userId;
  }

  const orynoUserId =
    typeof data.metadata?.oryno_user_id === "string"
      ? data.metadata.oryno_user_id
      : null;
  if (orynoUserId) return orynoUserId;

  const email = data.customer?.email?.toLowerCase();
  if (email) {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (user) return user.id;
  }

  return null;
}
