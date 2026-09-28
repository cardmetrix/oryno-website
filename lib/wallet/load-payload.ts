import { sql } from "drizzle-orm";
import {
  currencyForCountry,
  formatCountryMoney,
  getCountryInfo,
} from "@/lib/country";
import { db } from "@/lib/db";
import { getDisplayFx } from "@/lib/display-currency";
import { normalizeCompanyCharges } from "@/lib/company/charges";
import type { CompanyChargesConfig } from "@/lib/company/charge-types";
import { convertLocalToNgn, convertNgnToLocal, quoteLocalUsd as quoteLocalUsdBase } from "@/lib/fx/rates";
import { formatMoney, toAppTransaction } from "@/lib/transactions";
import type { SyncedUser } from "@/lib/auth/sync-user";
import type { WalletPayload } from "@/lib/wallet-types";
import {
  listBankAccounts,
  listTransactionRows,
  listUserWallets,
  toBankSummary,
  toWalletSummary,
  type BankAccountRow,
  type WalletRow,
} from "@/lib/wallet";
import { ensureLocalPrimaryWallet } from "@/lib/wallet/migrate-local-primary";
import { ensureUsdWallet } from "@/lib/wallet-usd";
import { getWithdrawMinimum } from "@/lib/wallet/withdraw-limits";

type TxRow = {
  id: string;
  type: string;
  category: string;
  title: string;
  subtitle: string | null;
  amount: string | number;
  currency: string;
  status: string;
  createdAt: string | Date;
};

type DashboardSnapshot = {
  wallets: WalletRow[];
  banks: BankAccountRow[];
  recent: TxRow[];
  charges: unknown;
};

function asDate(value: unknown) {
  if (value instanceof Date) return value;
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function asRecordArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeWallets(value: unknown): WalletRow[] {
  return asRecordArray<Partial<WalletRow>>(value).map((row) => ({
    ...(row as WalletRow),
    balance: String(row.balance ?? "0"),
    dailyLimit: row.dailyLimit == null ? null : String(row.dailyLimit),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));
}

function normalizeBanks(value: unknown): BankAccountRow[] {
  return asRecordArray<Partial<BankAccountRow>>(value).map((row) => ({
    ...(row as BankAccountRow),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  }));
}

function normalizeRecent(value: unknown): TxRow[] {
  return asRecordArray<TxRow>(value);
}

function needsWalletEnsure(rows: WalletRow[], currency: string) {
  const local = rows.find((wallet) => wallet.currency === currency);
  if (!local) return true;
  if (currency === "NGN") return false;
  const ngn = rows.find((wallet) => wallet.currency === "NGN");
  return Boolean(ngn && Number(ngn.balance) > 0);
}

async function loadDashboardSnapshot(userId: string): Promise<DashboardSnapshot> {
  const result = await db.execute(sql`
    SELECT jsonb_build_object(
      'wallets', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'userId', user_id,
            'currency', currency,
            'balance', balance::text,
            'status', status,
            'isPrimary', is_primary,
            'cardNumber', card_number,
            'dailyLimit', daily_limit::text,
            'createdAt', created_at,
            'updatedAt', updated_at
          )
          ORDER BY is_primary DESC, updated_at DESC
        )
        FROM wallets
        WHERE user_id = ${userId}::uuid
      ), '[]'::jsonb),
      'banks', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', id,
            'userId', user_id,
            'bankId', bank_id,
            'bankName', bank_name,
            'bankCode', bank_code,
            'accountName', account_name,
            'accountNumber', account_number,
            'paystackRecipientCode', paystack_recipient_code,
            'isPrimary', is_primary,
            'verified', verified,
            'createdAt', created_at,
            'updatedAt', updated_at
          )
          ORDER BY is_primary DESC, created_at DESC
        )
        FROM user_bank_accounts
        WHERE user_id = ${userId}::uuid
      ), '[]'::jsonb),
      'recent', COALESCE((
        SELECT jsonb_agg(item ORDER BY created_at DESC)
        FROM (
          SELECT
            jsonb_build_object(
              'id', id,
              'type', type,
              'category', category,
              'title', title,
              'subtitle', subtitle,
              'amount', amount::text,
              'currency', currency,
              'status', status,
              'createdAt', created_at
            ) AS item,
            created_at
          FROM transactions
          WHERE user_id = ${userId}::uuid
          ORDER BY created_at DESC
          LIMIT 8
        ) recent_rows
      ), '[]'::jsonb),
      'charges', (
        SELECT value
        FROM platform_settings
        WHERE key = 'company_charges'
      )
    ) AS payload
  `);

  const row = (Array.isArray(result) ? result[0] : null) as
    | { payload?: unknown }
    | undefined;
  const payload =
    row?.payload && typeof row.payload === "object"
      ? (row.payload as Record<string, unknown>)
      : typeof row?.payload === "string"
        ? (JSON.parse(row.payload) as Record<string, unknown>)
        : {};

  return {
    wallets: normalizeWallets(payload.wallets),
    banks: normalizeBanks(payload.banks),
    recent: normalizeRecent(payload.recent),
    charges: payload.charges ?? null,
  };
}

async function loadDashboardSnapshotFallback(
  userId: string,
): Promise<DashboardSnapshot> {
  const [wallets, banks, recent] = await Promise.all([
    listUserWallets(userId).catch(() => [] as WalletRow[]),
    listBankAccounts(userId).catch(() => [] as BankAccountRow[]),
    listTransactionRows(userId, 8).catch(() => []),
  ]);
  return {
    wallets,
    banks,
    recent: recent.map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      subtitle: row.subtitle,
      amount: row.amount,
      currency: row.currency,
      status: row.status,
      createdAt: row.createdAt,
    })),
    charges: null,
  };
}

function withdrawFeeFromCharges(
  charges: CompanyChargesConfig,
  countryCode: string | null | undefined,
  displayFx: Awaited<ReturnType<typeof getDisplayFx>>,
) {
  const currency = currencyForCountry(countryCode);
  const ngn = charges.services.withdraw.enabled
    ? Math.max(0, charges.withdrawFeeNgn)
    : 0;
  const local =
    currency === "NGN" ? ngn : convertNgnToLocal(ngn, displayFx.ngnToLocal);
  return {
    ngn,
    local,
    currency,
    formatted: formatCountryMoney(local, countryCode),
    formattedNgn: `₦${ngn.toFixed(2)}`,
  };
}

export async function loadWalletPayload(user: SyncedUser): Promise<WalletPayload> {
  const currency = currencyForCountry(user.countryCode);

  let [snapshot, displayFx] = await Promise.all([
    loadDashboardSnapshot(user.id).catch(async (error) => {
      console.error("[wallet-snapshot]", error);
      return loadDashboardSnapshotFallback(user.id);
    }),
    getDisplayFx(user.countryCode),
  ]);

  if (needsWalletEnsure(snapshot.wallets, currency)) {
    await ensureLocalPrimaryWallet({
      userId: user.id,
      countryCode: user.countryCode,
    }).catch(async (walletError) => {
      console.error("[wallet-get-primary]", walletError);
      return null;
    });
    snapshot = await loadDashboardSnapshot(user.id).catch(() => snapshot);
  }

  if (!snapshot.wallets.some((wallet) => wallet.currency === "USD")) {
    const usdRow = await ensureUsdWallet(user.id).catch((error) => {
      console.error("[wallet-get-usd]", error);
      return null;
    });
    if (usdRow) snapshot.wallets = [...snapshot.wallets, usdRow];
  }

  const charges = normalizeCompanyCharges(snapshot.charges);
  const [withdrawMinimum, fx] = await Promise.all([
    getWithdrawMinimum(user.countryCode, displayFx),
    quoteLocalUsdBase(currency, charges.fx).catch((error) => {
      console.error("[wallet-get-fx]", error);
      return null;
    }),
  ]);

  const primary =
    snapshot.wallets.find((wallet) => wallet.currency === currency) ??
    snapshot.wallets.find((wallet) => wallet.isPrimary) ??
    snapshot.wallets[0];
  if (!primary) {
    throw new Error("Unable to load wallet");
  }

  const walletsSummary = snapshot.wallets.map((wallet) => toWalletSummary(wallet));
  const primarySummary =
    walletsSummary.find((wallet) => wallet.id === primary.id) ??
    toWalletSummary(primary);
  const usdSummary =
    walletsSummary.find((wallet) => wallet.currency === "USD") ?? null;
  const recent = snapshot.recent.map((row) =>
    toAppTransaction(
      {
        ...row,
        balanceAfter: null,
        externalRef: null,
        metadata: null,
      },
      displayFx,
    ),
  );

  const primaryBalance = Number(primary.balance);
  const ledgerNgn =
    primary.currency === "NGN"
      ? primaryBalance
      : convertLocalToNgn(primaryBalance, displayFx.localToNgn);

  return {
    primary: primarySummary,
    usd: usdSummary,
    wallets: walletsSummary,
    banks: snapshot.banks.map(toBankSummary),
    recent,
    withdrawMinimum: {
      minNgn: withdrawMinimum.minNgn,
      minLocal: withdrawMinimum.minLocal,
      currency: withdrawMinimum.currency,
      formatted: withdrawMinimum.formatted,
      message: withdrawMinimum.message,
    },
    withdrawFee: withdrawFeeFromCharges(charges, user.countryCode, displayFx),
    fx,
    displayFx,
    ledgerNgn: ledgerNgn.toFixed(2),
    totals: {
      balance: primarySummary.balance,
      balanceFormatted: primarySummary.balanceFormatted,
      currency,
      usdBalance: usdSummary?.balance ?? "0.00",
      usdBalanceFormatted: usdSummary?.balanceFormatted ?? formatMoney(0, "USD"),
      bankCount: snapshot.banks.length,
      txCount: recent.length,
    },
    user: {
      fullName: user.fullName,
      countryCode: user.countryCode ?? "NG",
    },
    country: getCountryInfo(user.countryCode),
  };
}
