import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userBankAccounts } from "@/lib/db/schema";
import { resolveCountryCode } from "@/lib/country";
import {
  accountNumberRules,
  demoBanksForCountry,
} from "@/lib/payments/country";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";

export type FlutterwaveBankOption = {
  name: string;
  code: string;
  slug?: string;
  active?: boolean;
  type?: string;
  currency?: string;
};

export const DEMO_BANK_OPTIONS: FlutterwaveBankOption[] =
  demoBanksForCountry("NG");

type FlutterwaveBankRow = {
  id?: number;
  name: string;
  code: string;
  slug?: string;
};

const banksCache = new Map<
  string,
  { at: number; items: FlutterwaveBankOption[] }
>();
const BANKS_TTL_MS = 1000 * 60 * 60;

function normalizeAccountNumber(raw: string, countryCode?: string | null) {
  const rules = accountNumberRules(countryCode);
  return raw.replace(/\D/g, "").slice(0, rules.max);
}

function mapBankRows(
  rows: FlutterwaveBankRow[],
  fallbackType?: string,
): FlutterwaveBankOption[] {
  return rows
    .filter((b) => b.code && b.name)
    .map((b) => ({
      name: b.name,
      code: String(b.code),
      slug: b.slug,
      active: true,
      type: fallbackType,
    }));
}

async function fetchFlutterwaveBanks(country: string, type?: string) {
  const suffix = type ? `?type=${encodeURIComponent(type)}` : "";
  const res = await flutterwaveFetch<FlutterwaveBankRow[]>(
    `/banks/${encodeURIComponent(country)}${suffix}`,
  );
  return res.data ?? [];
}

export async function listFlutterwaveBanks(
  countryCode?: string | null,
): Promise<FlutterwaveBankOption[]> {
  const country = resolveCountryCode(countryCode);
  const cached = banksCache.get(country);
  if (cached && Date.now() - cached.at < BANKS_TTL_MS) {
    return cached.items;
  }

  if (!hasFlutterwaveKeys()) {
    return demoBanksForCountry(country);
  }

  try {
    const pages = [fetchFlutterwaveBanks(country)];
    if (country === "GH" || country === "KE") {
      pages.push(fetchFlutterwaveBanks(country, "mobile_money"));
    }
    const results = await Promise.allSettled(pages);
    const banks =
      results[0]?.status === "fulfilled" ? results[0].value : [];
    const momo =
      results[1]?.status === "fulfilled" ? results[1].value : [];

    const items = [
      ...mapBankRows(banks),
      ...mapBankRows(momo, "mobile_money"),
    ];

    const demoMomo = demoBanksForCountry(country).filter(
      (b) => b.type === "mobile_money",
    );
    for (const extra of demoMomo) {
      if (!items.some((b) => b.code === extra.code)) {
        items.push(extra);
      }
    }

    const seen = new Set<string>();
    const unique = items
      .filter((b) => {
        const key = `${b.code}:${b.type ?? ""}`;
        if (seen.has(key) || seen.has(b.code)) return false;
        seen.add(key);
        seen.add(b.code);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    banksCache.set(country, { at: Date.now(), items: unique });
    return unique;
  } catch (error) {
    console.error("[flutterwave-banks-list]", country, error);
    return demoBanksForCountry(country);
  }
}

export async function listPayoutBanks(countryCode?: string | null) {
  return listFlutterwaveBanks(countryCode);
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

  const banks = await listFlutterwaveBanks(country);
  const bank = banks.find((b) => b.code === bankCode);
  const bankName = bank?.name ?? "Bank";

  if (!hasFlutterwaveKeys()) {
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
    const res = await flutterwaveFetch<{
      account_number: string;
      account_name: string;
    }>("/accounts/resolve", {
      method: "POST",
      body: JSON.stringify({
        account_number: accountNumber,
        account_bank: bankCode,
        country,
      }),
    });

    return {
      accountNumber: res.data.account_number || accountNumber,
      accountName: (res.data.account_name || "").trim(),
      bankCode,
      bankName,
      type: bank?.type,
      unresolved: false,
      demoMode: isFlutterwaveDemoMode(),
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
        demoMode: isFlutterwaveDemoMode(),
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
  const banks = await listFlutterwaveBanks(country);
  const bank = banks.find((b) => b.code === bankCode);
  const type = input.type || bank?.type;

  return {
    recipientCode: `FLW_${bankCode}_${accountNumber}`,
    accountName,
    bankName: bank?.name,
    type,
    demoMode: isFlutterwaveDemoMode() || !hasFlutterwaveKeys(),
  };
}

export async function ensureBankRecipient(
  bank: typeof userBankAccounts.$inferSelect,
) {
  if (!bank.bankCode) {
    throw new Error("Bank account is missing a bank code. Re-add it.");
  }
  if (bank.paystackRecipientCode?.startsWith("FLW_")) {
    return bank.paystackRecipientCode;
  }

  const recipient = await createOrReuseTransferRecipient({
    accountName: bank.accountName,
    accountNumber: bank.accountNumber,
    bankCode: bank.bankCode,
  });

  await db
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
    );

  return recipient.recipientCode;
}
