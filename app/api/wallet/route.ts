import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getCountryInfo } from "@/lib/country";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
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

    // Sequential on serverless (max:1 pool) — parallel queries can flake
    const walletRows = await listUserWallets(user.id).catch((error) => {
      console.error("[wallet-get-list]", error);
      return [primary];
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

    const totalBalance = walletsSummary.reduce(
      (sum, w) => sum + Number(w.balance),
      0,
    );

    return NextResponse.json(
      {
        primary: primarySummary,
        wallets: walletsSummary,
        banks: bankRows.map(toBankSummary),
        recent,
        totals: {
          balance: totalBalance.toFixed(2),
          balanceFormatted: formatMoney(totalBalance, currency),
          currency,
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
