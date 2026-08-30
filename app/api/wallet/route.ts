import { NextResponse } from "next/server";
import { ensureAppUser } from "@/lib/auth/current-user";
import { getCountryInfo } from "@/lib/country";
import { ensureWalletSchema } from "@/lib/db/ensure-schema";
import { getDisplayFx } from "@/lib/display-currency";
import { quoteLocalUsd } from "@/lib/fx/rates";
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
import { formatMoney } from "@/lib/transactions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await ensureWalletSchema();

    const user = await ensureAppUser({ request: req });
    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "clerk_bearer_rejected",
        },
        { status: 401 },
      );
    }

    const displayFx = await getDisplayFx(user.countryCode);
    const currency = displayFx.to;

    let primary: WalletRow;
    try {
      // Non-NG markets still settle on the Nigeria (NGN) ledger, then convert.
      primary = await ensurePrimaryWallet(user.id, "NGN");
    } catch (walletError) {
      console.error("[wallet-get-primary]", walletError);
      const fallbackWallets = await listUserWallets(user.id).catch(() => []);
      const found =
        fallbackWallets.find((w) => w.currency === "NGN") ??
        fallbackWallets.find((w) => w.isPrimary) ??
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
    const recent = await recentWalletTransactions(user.id, 8, displayFx).catch(
      (error) => {
        console.error("[wallet-get-recent]", error);
        return [];
      },
    );

    const walletsSummary = walletRows.map((w) => toWalletSummary(w, displayFx));
    const primarySummary =
      walletsSummary.find((w) => w.id === primary.id) ??
      toWalletSummary(primary, displayFx);
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
        displayFx,
        ledgerNgn: Number(primary.balance).toFixed(2),
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
