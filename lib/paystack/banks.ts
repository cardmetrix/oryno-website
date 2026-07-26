import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userBankAccounts } from "@/lib/db/schema";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
  paystackFetch,
} from "@/lib/paystack/client";

export type PaystackBankOption = {
  name: string;
  code: string;
  slug?: string;
  active?: boolean;
};

/** Fallback list when Paystack keys are missing */
export const DEMO_BANK_OPTIONS: PaystackBankOption[] = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "Kuda", code: "50211" },
  { name: "Zenith Bank", code: "057" },
  { name: "UBA", code: "033" },
  { name: "First Bank", code: "011" },
  { name: "Opay", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Moniepoint", code: "50515" },
];

type PaystackBankRow = {
  name: string;
  code: string;
  slug?: string;
  active?: boolean;
  currency?: string;
};

type ResolveData = {
  account_number: string;
  account_name: string;
  bank_id?: number;
};

type RecipientData = {
  active: boolean;
  currency: string;
  name: string;
  recipient_code: string;
  type: string;
  details?: {
    account_number?: string;
    account_name?: string;
    bank_code?: string;
    bank_name?: string;
  };
};

let banksCache: { at: number; items: PaystackBankOption[] } | null = null;
const BANKS_TTL_MS = 1000 * 60 * 60;

export async function listNigerianBanks(): Promise<PaystackBankOption[]> {
  if (!hasPaystackKeys()) {
    return DEMO_BANK_OPTIONS;
  }

  if (banksCache && Date.now() - banksCache.at < BANKS_TTL_MS) {
    return banksCache.items;
  }

  try {
    const res = await paystackFetch<PaystackBankRow[]>(
      "/bank?country=nigeria&currency=NGN&perPage=100",
    );
    const items = (res.data ?? [])
      .filter((b) => b.active !== false && b.code && b.name)
      .map((b) => ({
        name: b.name,
        code: b.code,
        slug: b.slug,
        active: b.active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    banksCache = { at: Date.now(), items };
    return items;
  } catch (error) {
    console.error("[paystack-banks-list]", error);
    return DEMO_BANK_OPTIONS;
  }
}

export async function resolveBankAccount(input: {
  accountNumber: string;
  bankCode: string;
}) {
  const accountNumber = input.accountNumber.replace(/\D/g, "").slice(0, 10);
  const bankCode = input.bankCode.trim();

  if (accountNumber.length < 10) {
    throw new Error("Enter a valid 10-digit account number");
  }
  if (!bankCode) {
    throw new Error("Select a bank");
  }

  const banks = await listNigerianBanks();
  const bank = banks.find((b) => b.code === bankCode);
  const bankName = bank?.name ?? "Bank";

  if (!hasPaystackKeys()) {
    return {
      accountNumber,
      accountName: "DEMO ACCOUNT HOLDER",
      bankCode,
      bankName,
      demoMode: true,
    };
  }

  const res = await paystackFetch<ResolveData>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
  );

  return {
    accountNumber: res.data.account_number || accountNumber,
    accountName: res.data.account_name.trim(),
    bankCode,
    bankName,
    demoMode: isPaystackDemoMode(),
  };
}

export async function createOrReuseTransferRecipient(input: {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
}) {
  const accountNumber = input.accountNumber.replace(/\D/g, "").slice(0, 10);
  const bankCode = input.bankCode.trim();
  const accountName = input.accountName.trim();
  const currency = (input.currency ?? "NGN").toUpperCase();

  if (!hasPaystackKeys()) {
    return {
      recipientCode: `RCP_DEMO_${accountNumber}`,
      accountName,
      bankName:
        DEMO_BANK_OPTIONS.find((b) => b.code === bankCode)?.name ?? "Bank",
      demoMode: true as const,
    };
  }

  const res = await paystackFetch<RecipientData>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency,
    }),
  });

  return {
    recipientCode: res.data.recipient_code,
    accountName: res.data.details?.account_name?.trim() || accountName,
    bankName: res.data.details?.bank_name || undefined,
    demoMode: isPaystackDemoMode() as boolean,
  };
}

export async function ensureBankRecipient(
  bank: typeof userBankAccounts.$inferSelect,
  currency = "NGN",
) {
  if (bank.paystackRecipientCode) {
    return bank.paystackRecipientCode;
  }
  if (!bank.bankCode) {
    throw new Error("Bank account is missing a Paystack bank code. Re-add it.");
  }

  const recipient = await createOrReuseTransferRecipient({
    accountName: bank.accountName,
    accountNumber: bank.accountNumber,
    bankCode: bank.bankCode,
    currency,
  });

  const [updated] = await db
    .update(userBankAccounts)
    .set({
      paystackRecipientCode: recipient.recipientCode,
      verified: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(userBankAccounts.id, bank.id),
        eq(userBankAccounts.userId, bank.userId),
      ),
    )
    .returning();

  return updated?.paystackRecipientCode ?? recipient.recipientCode;
}
