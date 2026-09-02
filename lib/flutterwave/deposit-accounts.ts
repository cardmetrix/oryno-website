import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  userDepositAccounts,
  users,
  walletFundings,
  wallets,
} from "@/lib/db/schema";
import {
  buildDepositIdentityRequired,
  getUserDepositIdentity,
  nigerianDepositIdentityRequired,
  saveDepositIdentity,
  type DepositIdentityRequired,
} from "@/lib/flutterwave/deposit-identity";
import { getServerEgressIp } from "@/lib/flutterwave/egress-ip";
import { humanizeFlutterwaveSetupError, isFlutterwaveIpWhitelistError } from "@/lib/flutterwave/errors";
import { notifyWalletFunded } from "@/lib/notify/fund-events";
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
  flutterwaveSupportsVirtualAccount,
  fundPresetsForCountry,
  paystackDepositAccountFallback,
} from "@/lib/payments/country";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";
import { hasPaystackKeys } from "@/lib/paystack/client";

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
  const demoMode =
    row.provider.endsWith("_demo") ||
    (isFlutterwaveDemoMode() && !hasPaystackKeys());
  return {
    id: row.id,
    accountNumber: row.accountNumber,
    accountName: row.accountName,
    bankName: row.bankName,
    bankSlug: row.bankSlug,
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    demoMode,
    instructions:
      "Transfer any amount to this account. Your ORYNO wallet is credited automatically after payment is confirmed.",
  };
}

function demoAccountNumber(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(hash, 131) + userId.charCodeAt(i)) >>> 0;
  }
  return String(1_000_000_000 + (hash % 900_000_000)).slice(0, 10);
}

function vaReferenceForUser(userId: string) {
  return `VA_${userId.replace(/-/g, "")}`;
}

export function userIdFromVaReference(txRef?: string | null) {
  if (!txRef) return null;
  const raw = txRef.replace(/^VA_/i, "");
  if (raw.length !== 32 || !/^[0-9a-f]+$/i.test(raw)) return null;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

async function createDemoDepositAccount(user: typeof users.$inferSelect) {
  const country = resolveCountryCode(user.countryCode);
  const currency = currencyForCountry(country);
  const [created] = await db
    .insert(userDepositAccounts)
    .values({
      userId: user.id,
      provider: "flutterwave_demo",
      currency,
      accountNumber: demoAccountNumber(user.id),
      accountName: user.fullName.toUpperCase(),
      bankName: "ORYNO Bank",
      bankSlug: "oryno",
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

async function identityForVirtualAccount(user: typeof users.$inferSelect) {
  return getUserDepositIdentity(user.id);
}

export { saveDepositIdentity, type DepositIdentityRequired };

type FlutterwaveVirtualAccount = {
  id?: number | string;
  flw_ref?: string;
  order_ref?: string;
  account_number?: string;
  bank_name?: string;
  note?: string;
  amount?: number | null;
  created_at?: string;
};

function digitsPhone(phone?: string | null) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-11).padStart(11, "0");
  return "08100000000";
}

async function saveDepositAccount(
  user: typeof users.$inferSelect,
  values: {
    provider: string;
    currency: string;
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankSlug: string;
    paystackCustomerCode?: string | null;
    paystackAccountId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, user.id),
  });

  if (existing) {
    const [updated] = await db
      .update(userDepositAccounts)
      .set({
        provider: values.provider,
        currency: values.currency,
        accountNumber: values.accountNumber,
        accountName: values.accountName,
        bankName: values.bankName,
        bankSlug: values.bankSlug,
        paystackCustomerCode: values.paystackCustomerCode ?? existing.paystackCustomerCode,
        paystackAccountId: values.paystackAccountId ?? existing.paystackAccountId,
        status: "active",
        metadata: values.metadata ?? existing.metadata,
        updatedAt: new Date(),
      })
      .where(eq(userDepositAccounts.id, existing.id))
      .returning();
    return updated ?? existing;
  }

  const [created] = await db
    .insert(userDepositAccounts)
    .values({
      userId: user.id,
      provider: values.provider,
      currency: values.currency,
      accountNumber: values.accountNumber,
      accountName: values.accountName,
      bankName: values.bankName,
      bankSlug: values.bankSlug,
      paystackCustomerCode: values.paystackCustomerCode,
      paystackAccountId: values.paystackAccountId,
      status: "active",
      metadata: values.metadata,
    })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const row = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, user.id),
  });
  if (!row) throw new Error("Unable to save deposit account");
  return row;
}

async function createFlutterwaveDepositAccount(
  user: typeof users.$inferSelect,
) {
  const country = resolveCountryCode(user.countryCode);
  const currency = currencyForCountry(country);
  const firstName = user.fullName.split(" ")[0] || "ORYNO";
  const lastName = user.fullName.split(" ").slice(1).join(" ") || "User";
  const txRef = vaReferenceForUser(user.id);
  const payload: Record<string, unknown> = {
    email: user.email,
    is_permanent: true,
    tx_ref: txRef,
    narration: (user.fullName || "ORYNO User").slice(0, 35),
    phonenumber: digitsPhone(user.phone),
    firstname: firstName,
    lastname: lastName || "User",
    currency,
  };

  if (country === "NG") {
    const identity = await identityForVirtualAccount(user);
    if (identity.bvn) payload.bvn = identity.bvn;
    else if (identity.nin) payload.nin = identity.nin;
    else if (isFlutterwaveDemoMode()) payload.bvn = "22222222280";
    else {
      throw new Error(
        "Add your BVN or NIN to get a dedicated account number.",
      );
    }
    const bankCode = process.env.FLUTTERWAVE_DVA_BANK_CODE?.trim();
    if (bankCode) payload.bank_code = bankCode;
  }

  let created: { data: FlutterwaveVirtualAccount };
  try {
    created = await flutterwaveFetch<FlutterwaveVirtualAccount>(
      "/virtual-account-numbers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/bvn|nin/i.test(message)) {
      throw new Error(
        "Complete KYC with your BVN or NIN to get a dedicated account number.",
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }

  const data = created.data;
  if (!data?.account_number) {
    throw new Error("Could not create your dedicated deposit account.");
  }

  return saveDepositAccount(user, {
    provider: "flutterwave",
    currency,
    accountNumber: data.account_number,
    accountName: user.fullName.toUpperCase(),
    bankName: data.bank_name || "Flutterwave",
    bankSlug: "flutterwave",
    paystackCustomerCode: data.order_ref || txRef,
    paystackAccountId: String(data.flw_ref || data.id || ""),
    metadata: {
      mode: isFlutterwaveDemoMode() ? "test" : "live",
      tx_ref: txRef,
      raw: data,
    },
  });
}

function isDemoProvider(provider: string) {
  return provider.endsWith("_demo");
}

export async function getOrCreateDepositAccount(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user) throw new Error("User not found");

  const country = resolveCountryCode(user.countryCode);
  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, userId),
  });

  const liveFlutterwave =
    existing &&
    existing.provider === "flutterwave" &&
    existing.accountNumber &&
    !isDemoProvider(existing.provider);

  if (liveFlutterwave) {
    return toDto(existing);
  }

  let lastError: Error | null = null;

  if (flutterwaveSupportsVirtualAccount(country) && hasFlutterwaveKeys()) {
    try {
      const created = await createFlutterwaveDepositAccount(user);
      return toDto(created);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error("[wallet-fund-flw-dva]", lastError);
    }
  }

  if (paystackDepositAccountFallback(country) && hasPaystackKeys()) {
    try {
      const { createPaystackDepositAccount } = await import("@/lib/paystack/dva");
      const created = await createPaystackDepositAccount(user);
      return toDto(created);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error("[wallet-fund-paystack-dva]", lastError);
    }
  }

  if (existing?.accountNumber) {
    return toDto(existing);
  }

  if (!hasFlutterwaveKeys() && !hasPaystackKeys()) {
    const demo = await createDemoDepositAccount(user);
    return toDto(demo);
  }

  throw lastError ?? new Error("Could not create your dedicated deposit account.");
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
  const provider =
    input.channel?.includes("paystack") ||
    String(input.raw?.provider || "").includes("paystack")
      ? "paystack"
      : "flutterwave";

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
        subtitle: "Bank transfer",
        amount,
        currency,
        status: "completed",
        balanceAfter: nextBalance,
        externalRef: input.reference,
        metadata: {
          channel: input.channel ?? "bank_transfer",
          provider,
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
          provider,
          channel: input.channel ?? "virtual_account",
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
    void notifyWalletFunded({
      userId: input.userId,
      amountFormatted,
      reference: input.reference,
      transactionId: result.transaction.id,
      fundingId: result.funding.id,
      href: "/wallet",
    }).catch((notifyError) => {
      console.error("[flutterwave-deposit-notify]", notifyError);
    });
  } catch (notifyError) {
    console.error("[flutterwave-deposit-notify]", notifyError);
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
  const demoMode = isFlutterwaveDemoMode();

  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, user.id),
  });

  const hasLiveAccount =
    existing?.accountNumber &&
    !isDemoProvider(existing.provider) &&
    (existing.provider === "flutterwave" || existing.provider === "paystack");

  let identityRequired: DepositIdentityRequired | null = null;
  let account: DepositAccountDto | null = null;
  let loadError: string | null = null;
  let setupHint: string | null = null;
  let serverEgressIp: string | null = null;

  if (hasLiveAccount) {
    account = toDto(existing);
  } else if (
    nigerianDepositIdentityRequired(countryCode) &&
    flutterwaveSupportsVirtualAccount(countryCode) &&
    hasFlutterwaveKeys()
  ) {
    const identity = await getUserDepositIdentity(user.id);
    if (!identity.bvn && !identity.nin) {
      identityRequired = await buildDepositIdentityRequired(user);
    }
  }

  if (!account && !identityRequired) {
    try {
      account = await getOrCreateDepositAccount(user.id);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load deposit account";
      if (/bvn|nin/i.test(message)) {
        identityRequired = await buildDepositIdentityRequired(user);
      } else {
        if (isFlutterwaveIpWhitelistError(message)) {
          serverEgressIp = await getServerEgressIp();
          loadError = "Payment provider blocked this server (IP whitelist).";
          setupHint = humanizeFlutterwaveSetupError(message, serverEgressIp);
        } else {
          loadError = message;
        }
      }
    }
  }

  return {
    method: "dva" as WalletFundMethod,
    checkoutAvailable: false,
    dvaAvailable: true,
    countryCode,
    currency,
    presets,
    account,
    identityRequired,
    error: loadError,
    setupHint,
    serverEgressIp,
    demoMode,
  };
}

export async function reverseDeposit(input: {
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
          ? "This deposit was already reversed."
          : "A deposit was reversed and deducted from your wallet.",
        type: "fund",
        metadata: {
          href: "/wallet",
          fundingId: funding.id,
          transactionId: funding.transactionId,
        },
      });
    } catch (notifyError) {
      console.error("[deposit-reverse-notify]", notifyError);
    }

    return {
      ok: true as const,
      already: result.already,
      status: "reversed" as const,
    };
  } catch (error) {
    console.error("[deposit-reverse]", error);
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

export const reversePaystackDeposit = reverseDeposit;

function metaString(
  meta: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = meta?.[key];
  return typeof value === "string" ? value : null;
}

export async function findUserIdForDepositCharge(data: {
  customer?: { customer_code?: string; email?: string };
  authorization?: { receiver_bank_account_number?: string };
  account_number?: string;
  account_id?: string;
  tx_ref?: string;
  flw_ref?: string;
  order_ref?: string;
  meta?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}) {
  const meta = data.meta ?? data.metadata ?? null;
  const orynoUserId =
    metaString(meta, "oryno_user_id") || metaString(meta, "orynoUserId");
  if (orynoUserId) return orynoUserId;

  const fromVa = userIdFromVaReference(data.tx_ref);
  if (fromVa) return fromVa;

  const fromOrderRef = userIdFromVaReference(data.order_ref);
  if (fromOrderRef) return fromOrderRef;

  const customerCode = data.customer?.customer_code;
  if (customerCode) {
    const byCustomer = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.paystackCustomerCode, customerCode),
    });
    if (byCustomer) return byCustomer.userId;
  }

  const orderRef = metaString(meta, "originatoraccountnumber");
  const accountNumber =
    data.account_number ||
    data.authorization?.receiver_bank_account_number ||
    orderRef;
  if (accountNumber) {
    const normalized = accountNumber.replace(/\D/g, "");
    const byAccount = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.accountNumber, accountNumber),
    });
    if (byAccount) return byAccount.userId;
    if (normalized && normalized !== accountNumber) {
      const byDigits = await db.query.userDepositAccounts.findFirst({
        where: eq(userDepositAccounts.accountNumber, normalized),
      });
      if (byDigits) return byDigits.userId;
    }
  }

  if (data.account_id) {
    const byAccountId = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.paystackAccountId, data.account_id),
    });
    if (byAccountId) return byAccountId.userId;
  }

  if (data.flw_ref) {
    const byFlw = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.paystackAccountId, data.flw_ref),
    });
    if (byFlw) return byFlw.userId;
  }

  for (const ref of [data.tx_ref, data.order_ref, data.flw_ref]) {
    if (!ref) continue;
    const byRef = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.paystackCustomerCode, ref),
    });
    if (byRef) return byRef.userId;
  }

  const email = data.customer?.email?.trim().toLowerCase();
  if (email) {
    const user = await db.query.users.findFirst({
      where: sql`lower(${users.email}) = ${email}`,
    });
    if (user) return user.id;
  }

  return null;
}

export const findUserIdForPaystackCharge = findUserIdForDepositCharge;
