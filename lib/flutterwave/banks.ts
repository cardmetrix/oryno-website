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
  return Array.isArray(res.data) ? res.data : [];
}

/** Paystack uses the same CBN NUBAN codes Flutterwave expects for NG transfers. */
async function fetchPaystackNigerianBanks(): Promise<FlutterwaveBankOption[]> {
  const { hasPaystackKeys, paystackFetch } = await import(
    "@/lib/paystack/client"
  );
  if (!hasPaystackKeys()) return [];

  const res = await paystackFetch<
    Array<{ name?: string; code?: string; active?: boolean; is_deleted?: boolean }>
  >("/bank?country=nigeria&perPage=100");

  return (res.data ?? [])
    .filter((b) => b.code && b.name && b.active !== false && !b.is_deleted)
    .map((b) => ({
      name: String(b.name),
      code: String(b.code),
      active: true,
    }));
}

function dedupeBanks(items: FlutterwaveBankOption[]) {
  const seen = new Set<string>();
  return items
    .filter((b) => {
      const key = `${b.code}:${b.type ?? ""}`;
      if (seen.has(key) || seen.has(b.code)) return false;
      seen.add(key);
      seen.add(b.code);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listFlutterwaveBanks(
  countryCode?: string | null,
): Promise<FlutterwaveBankOption[]> {
  const country = resolveCountryCode(countryCode);
  const cached = banksCache.get(country);
  if (cached && cached.items.length > 0 && Date.now() - cached.at < BANKS_TTL_MS) {
    return cached.items;
  }

  if (!hasFlutterwaveKeys()) {
    // Still try Paystack for live NG bank lists when Flutterwave keys are absent.
    if (country === "NG") {
      try {
        const paystackBanks = await fetchPaystackNigerianBanks();
        if (paystackBanks.length) {
          const unique = dedupeBanks(paystackBanks);
          banksCache.set(country, { at: Date.now(), items: unique });
          return unique;
        }
      } catch (error) {
        console.error("[paystack-banks-list-fallback]", error);
      }
    }
    return demoBanksForCountry(country);
  }

  try {
    let banks: FlutterwaveBankRow[] = [];
    let momo: FlutterwaveBankRow[] = [];
    let primaryFailed = false;

    try {
      banks = await fetchFlutterwaveBanks(country);
    } catch (error) {
      primaryFailed = true;
      console.error("[flutterwave-banks-list]", country, error);
    }

    if (country === "GH" || country === "KE") {
      try {
        momo = await fetchFlutterwaveBanks(country, "mobile_money");
      } catch (error) {
        console.error("[flutterwave-banks-momo]", country, error);
      }
    }

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

    let unique = dedupeBanks(items);

    // Flutterwave IP/proxy failures used to cache [] via allSettled — recover with
    // Paystack (NG) or demo banks so Add bank is never an empty select.
    if (unique.length === 0) {
      if (country === "NG") {
        try {
          unique = dedupeBanks(await fetchPaystackNigerianBanks());
        } catch (error) {
          console.error("[paystack-banks-list-fallback]", error);
        }
      }
      if (unique.length === 0) {
        unique = dedupeBanks(demoBanksForCountry(country));
      }
      if (primaryFailed) {
        console.warn(
          `[flutterwave-banks-list] using fallback banks for ${country} (${unique.length})`,
        );
      }
    }

    if (unique.length > 0) {
      banksCache.set(country, { at: Date.now(), items: unique });
    }
    return unique;
  } catch (error) {
    console.error("[flutterwave-banks-list]", country, error);
    if (country === "NG") {
      try {
        const paystackBanks = dedupeBanks(await fetchPaystackNigerianBanks());
        if (paystackBanks.length) return paystackBanks;
      } catch {
        // fall through to demo
      }
    }
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
