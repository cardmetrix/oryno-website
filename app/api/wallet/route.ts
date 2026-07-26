import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  listBankAccounts,
  listUserWallets,
  recentWalletTransactions,
  toBankSummary,
  toWalletSummary,
} from "@/lib/wallet";
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await ensureAppUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currency = currencyForCountry(user.countryCode);
    const primary = await ensurePrimaryWallet(user.id, currency);
    const [walletRows, bankRows, recent] = await Promise.all([
      listUserWallets(user.id),
      listBankAccounts(user.id),
      recentWalletTransactions(user.id, 8),
    ]);

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
      },
      {
        headers: {
          "Cache-Control": "private, max-age=0, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("[wallet-get]", error);
    return NextResponse.json(
      { error: "Failed to load wallet" },
      { status: 500 },
    );
  }
}
