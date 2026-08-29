import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userBankAccounts } from "@/lib/db/schema";
import { currencyForCountry, resolveCountryCode } from "@/lib/country";
import {
  accountNumberRules,
  demoBanksForCountry,
  paystackCountrySlug,
  paystackRecipientType,
} from "@/lib/paystack/country";
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
  type?: string;
  currency?: string;
};

/** Fallback list when Paystack keys are missing (Nigeria). */
export const DEMO_BANK_OPTIONS: PaystackBankOption[] = demoBanksForCountry("NG");

type PaystackBankRow = {
  name: string;
  code: string;
  slug?: string;
  active?: boolean;
  currency?: string;
  type?: string;
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

const banksCache = new Map<string, { at: number; items: PaystackBankOption[] }>();
const BANKS_TTL_MS = 1000 * 60 * 60;

function normalizeAccountNumber(raw: string, countryCode?: string | null) {
  const rules = accountNumberRules(countryCode);
  return raw.replace(/\D/g, "").slice(0, rules.max);
}

function recipientTypeForBank(
  bank: PaystackBankOption | undefined,
  countryCode?: string | null,
) {
  if (bank?.type === "mobile_money") return "mobile_money";
  return paystackRecipientType(countryCode);
}

async function fetchPaystackBankPage(
  countrySlug: string,
  currency: string,
  type?: string,
) {
  const params = new URLSearchParams({
    country: countrySlug,
    currency,
    perPage: "100",
  });
  if (type) params.set("type", type);
  const res = await paystackFetch<PaystackBankRow[]>(`/bank?${params.toString()}`);
  return res.data ?? [];
}

function mapBankRows(rows: PaystackBankRow[], fallbackType?: string) {
  return rows
    .filter((b) => b.active !== false && b.code && b.name)
    .map((b) => ({
      name: b.name,
      code: String(b.code),
      slug: b.slug,
      active: b.active,
      type: b.type || fallbackType,
      currency: b.currency,
    }));
}

export async function listPaystackBanks(
  countryCode?: string | null,
): Promise<PaystackBankOption[]> {
  const country = resolveCountryCode(countryCode);
  const cacheKey = country;
  const cached = banksCache.get(cacheKey);
  if (cached && Date.now() - cached.at < BANKS_TTL_MS) {
    return cached.items;
  }

  if (!hasPaystackKeys()) {
    return demoBanksForCountry(country);
  }

  const slug = paystackCountrySlug(country);
  const currency = currencyForCountry(country);

  try {
    const pages = [fetchPaystackBankPage(slug, currency)];
    if (country === "GH" || country === "KE") {
      pages.push(fetchPaystackBankPage(slug, currency, "mobile_money"));
    }
    const [banks, momo] = await Promise.all(pages);
    const items = [
      ...mapBankRows(banks),
      ...mapBankRows(momo ?? [], "mobile_money"),
    ];

    const seen = new Set<string>();
    const unique = items.filter((b) => {
      const key = `${b.code}:${b.type ?? ""}`;
      if (seen.has(key) || seen.has(b.code)) return false;
      seen.add(key);
      seen.add(b.code);
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));

    banksCache.set(cacheKey, { at: Date.now(), items: unique });
    return unique;
  } catch (error) {
    console.error("[paystack-banks-list]", country, error);
    return demoBanksForCountry(country);
  }
}

export async function listNigerianBanks(): Promise<PaystackBankOption[]> {
  return listPaystackBanks("NG");
}

export async function resolveBankAccount(input: {
  accountNumber: string;
  bankCode: string;
  countryCode?: string | null;
}) {
  const country = resolveCountryCode(input.countryCode);
  const rules = accountNumberRules(country);
  const accountNumber = normalizeAccountNumber(input.accountNumber, country);
  const bankCode = input.bankCode.trim();

  if (accountNumber.length < rules.min) {
    throw new Error(`Enter a valid ${rules.label.toLowerCase()}`);
  }
  if (!bankCode) {
    throw new Error("Select a bank");
  }

  const banks = await listPaystackBanks(country);
  const bank = banks.find((b) => b.code === bankCode);
  const bankName = bank?.name ?? "Bank";

  if (!hasPaystackKeys()) {
    return {
      accountNumber,
      accountName: "DEMO ACCOUNT HOLDER",
      bankCode,
      bankName,
      type: bank?.type,
      unresolved: false,
      demoMode: true,
    };
  }

  try {
    const res = await paystackFetch<ResolveData>(
      `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
    );

    return {
      accountNumber: res.data.account_number || accountNumber,
      accountName: res.data.account_name.trim(),
      bankCode,
      bankName,
      type: bank?.type,
      unresolved: false,
      demoMode: isPaystackDemoMode(),
    };
  } catch (error) {
    if (country !== "NG") {
      return {
        accountNumber,
        accountName: "",
        bankCode,
        bankName,
        type: bank?.type,
        unresolved: true,
        demoMode: isPaystackDemoMode(),
        message:
          error instanceof Error
            ? error.message
            : "Enter the account name as it appears on your bank or mobile-money wallet",
      };
    }
    throw error;
  }
}

export async function createOrReuseTransferRecipient(input: {
  accountName: string;
  accountNumber: string;
  bankCode: string;
  currency?: string;
  countryCode?: string | null;
  type?: string;
}) {
  const country = resolveCountryCode(input.countryCode);
  const accountNumber = normalizeAccountNumber(input.accountNumber, country);
  const bankCode = input.bankCode.trim();
  const accountName = input.accountName.trim();
  const currency = (input.currency ?? currencyForCountry(country)).toUpperCase();
  const banks = await listPaystackBanks(country);
  const bank = banks.find((b) => b.code === bankCode);
  const type = input.type || recipientTypeForBank(bank, country);

  if (!hasPaystackKeys()) {
    return {
      recipientCode: `RCP_DEMO_${accountNumber}`,
      accountName,
      bankName: bank?.name ?? demoBanksForCountry(country).find((b) => b.code === bankCode)?.name ?? "Bank",
      type,
      demoMode: true as const,
    };
  }

  const res = await paystackFetch<RecipientData>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type,
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency,
    }),
  });

  return {
    recipientCode: res.data.recipient_code,
    accountName: res.data.details?.account_name?.trim() || accountName,
    bankName: res.data.details?.bank_name || bank?.name || undefined,
    type,
    demoMode: isPaystackDemoMode() as boolean,
  };
}

export async function ensureBankRecipient(
  bank: typeof userBankAccounts.$inferSelect,
  currency = "NGN",
  countryCode?: string | null,
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
    countryCode,
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
