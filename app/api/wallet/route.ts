import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getCountryInfo } from "@/lib/country";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { quoteLocalUsd } from "@/lib/fx/rates";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  listBankAccounts,
  listUserWallets,
  recentWalletTransactions,
  toBankSummary,
  toWalletSummary,
  type WalletRow,
} from "@/lib/wallet";
import { ensureUsdWallet } from "@/lib/wallet-usd";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  try {
    await ensureWalletSchema();

    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currency = currencyForCountry(user.countryCode);

    let primary: WalletRow;
    try {
      primary = await ensurePrimaryWallet(user.id, currency);
    } catch (walletError) {
      console.error("[wallet-get-primary]", walletError);
      const fallbackWallets = await listUserWallets(user.id).catch(() => []);
      const found =
        fallbackWallets.find((w) => w.isPrimary) ??
        fallbackWallets.find((w) => w.currency === currency) ??
        fallbackWallets[0];
      if (!found) throw walletError;
      primary = found;
    }

    const usdRow = await ensureUsdWallet(user.id).catch((error) => {
      console.error("[wallet-get-usd]", error);
      return null;
    });

    const walletRows = await listUserWallets(user.id).catch((error) => {
      console.error("[wallet-get-list]", error);
      return [primary, ...(usdRow ? [usdRow] : [])];
    });
    const bankRows = await listBankAccounts(user.id).catch((error) => {
      console.error("[wallet-get-banks]", error);
      return [];
    });
    const recent = await recentWalletTransactions(user.id, 8).catch(
      (error) => {
        console.error("[wallet-get-recent]", error);
        return [];
      },
    );

    const walletsSummary = walletRows.map(toWalletSummary);
    const primarySummary =
      walletsSummary.find((w) => w.id === primary.id) ??
      toWalletSummary(primary);
    const usdSummary =
      (usdRow && walletsSummary.find((w) => w.id === usdRow.id)) ||
      (usdRow ? toWalletSummary(usdRow) : null) ||
      walletsSummary.find((w) => w.currency === "USD") ||
      null;

    const fx = await quoteLocalUsd(currency).catch((error) => {
      console.error("[wallet-get-fx]", error);
      return null;
    });

    return NextResponse.json(
      {
        primary: primarySummary,
        usd: usdSummary,
        wallets: walletsSummary,
        banks: bankRows.map(toBankSummary),
        recent,
        fx,
        totals: {
          balance: primarySummary.balance,
          balanceFormatted: primarySummary.balanceFormatted,
          currency,
          usdBalance: usdSummary?.balance ?? "0.00",
          usdBalanceFormatted:
            usdSummary?.balanceFormatted ?? formatMoney(0, "USD"),
          bankCount: bankRows.length,
          txCount: recent.length,
        },
        user: {
          fullName: user.fullName,
          countryCode: user.countryCode ?? "NG",
        },
        country: getCountryInfo(user.countryCode),
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[wallet-get]", error);
    const message =
      error instanceof Error ? error.message : "Failed to load wallet";
    return NextResponse.json(
      {
        error: "Failed to load wallet",
        message,
      },
      { status: 500 },
    );
  }
}
