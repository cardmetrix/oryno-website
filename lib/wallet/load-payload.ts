import { getCountryInfo } from "@/lib/country";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { getDisplayFx } from "@/lib/display-currency";
import { quoteLocalUsd } from "@/lib/fx/rates";
import { formatMoney } from "@/lib/transactions";
import type { SyncedUser } from "@/lib/auth/sync-user";
import type { WalletPayload } from "@/lib/wallet-types";
import {
  ensurePrimaryWallet,
  listBankAccounts,
  listUserWallets,
  recentWalletTransactions,
  toBankSummary,
  toWalletSummary,
  type WalletRow,
} from "@/lib/wallet";
import { ensureUsdWallet } from "@/lib/wallet-usd";
import { getWithdrawMinimum } from "@/lib/wallet/withdraw-limits";

export async function loadWalletPayload(user: SyncedUser): Promise<WalletPayload> {
  await ensureWalletSchema();

  const displayFx = await getDisplayFx(user.countryCode);
  const currency = displayFx.to;

  const [withdrawMinimum, primaryResult, usdRow, bankRows] = await Promise.all([
    getWithdrawMinimum(user.countryCode, displayFx),
    ensurePrimaryWallet(user.id, "NGN").catch(async (walletError) => {
      console.error("[wallet-get-primary]", walletError);
      const fallbackWallets = await listUserWallets(user.id).catch(() => []);
      const found =
        fallbackWallets.find((w) => w.currency === "NGN") ??
        fallbackWallets.find((w) => w.isPrimary) ??
        fallbackWallets[0];
      if (!found) throw walletError;
      return found;
    }),
    ensureUsdWallet(user.id).catch((error) => {
      console.error("[wallet-get-usd]", error);
      return null;
    }),
    listBankAccounts(user.id).catch((error) => {
      console.error("[wallet-get-banks]", error);
      return [];
    }),
  ]);

  const primary: WalletRow = primaryResult;

  const [walletRows, recent, fx] = await Promise.all([
    listUserWallets(user.id).catch((error) => {
      console.error("[wallet-get-list]", error);
      return [primary, ...(usdRow ? [usdRow] : [])];
    }),
    recentWalletTransactions(user.id, 8, displayFx).catch((error) => {
      console.error("[wallet-get-recent]", error);
      return [];
    }),
    quoteLocalUsd(currency).catch((error) => {
      console.error("[wallet-get-fx]", error);
      return null;
    }),
  ]);

  const walletsSummary = walletRows.map((w) => toWalletSummary(w, displayFx));
  const primarySummary =
    walletsSummary.find((w) => w.id === primary.id) ??
    toWalletSummary(primary, displayFx);
  const usdSummary =
    (usdRow && walletsSummary.find((w) => w.id === usdRow.id)) ||
    (usdRow ? toWalletSummary(usdRow) : null) ||
    walletsSummary.find((w) => w.currency === "USD") ||
    null;

  return {
    primary: primarySummary,
    usd: usdSummary,
    wallets: walletsSummary,
    banks: bankRows.map(toBankSummary),
    recent,
    withdrawMinimum: {
      minNgn: withdrawMinimum.minNgn,
      minLocal: withdrawMinimum.minLocal,
      currency: withdrawMinimum.currency,
      formatted: withdrawMinimum.formatted,
      message: withdrawMinimum.message,
    },
    fx,
    displayFx,
    ledgerNgn: Number(primary.balance).toFixed(2),
    totals: {
      balance: primarySummary.balance,
      balanceFormatted: primarySummary.balanceFormatted,
      currency,
      usdBalance: usdSummary?.balance ?? "0.00",
      usdBalanceFormatted: usdSummary?.balanceFormatted ?? formatMoney(0, "USD"),
      bankCount: bankRows.length,
      txCount: recent.length,
    },
    user: {
      fullName: user.fullName,
      countryCode: user.countryCode ?? "NG",
    },
    country: getCountryInfo(user.countryCode),
  };
}
