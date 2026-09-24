import { and, eq } from "drizzle-orm";
import { currencyForCountry, resolveCountryCode } from "@/lib/country";
import { db } from "@/lib/db";
import { transactions, wallets } from "@/lib/db/schema";
import { getDisplayFx } from "@/lib/display-currency";
import { convertNgnToLocal, roundMoney } from "@/lib/fx/rates";
import { ensurePrimaryWallet, type WalletRow } from "@/lib/wallet";

/**
 * Ensure the user's primary wallet is in their country local currency.
 * Non-NG users who still hold an NGN primary (legacy FX-display model) are
 * migrated: NGN balance → local at current mid FX, NGN wallet demoted.
 */
export async function ensureLocalPrimaryWallet(input: {
  userId: string;
  countryCode?: string | null;
}): Promise<WalletRow> {
  const country = resolveCountryCode(input.countryCode);
  const localCurrency = currencyForCountry(country);
  const primary = await ensurePrimaryWallet(input.userId, localCurrency);

  if (localCurrency === "NGN") return primary;

  const ngnWallet = await db.query.wallets.findFirst({
    where: and(eq(wallets.userId, input.userId), eq(wallets.currency, "NGN")),
  });
  if (!ngnWallet) return primary;

  const ngnBalance = Number(ngnWallet.balance);
  if (!Number.isFinite(ngnBalance) || ngnBalance <= 0) {
    if (ngnWallet.isPrimary) {
      await db
        .update(wallets)
        .set({ isPrimary: false, updatedAt: new Date() })
        .where(eq(wallets.id, ngnWallet.id));
    }
    return primary;
  }

  const fx = await getDisplayFx(country);
  const localCredit = roundMoney(convertNgnToLocal(ngnBalance, fx.ngnToLocal));
  if (localCredit < 0.01) return primary;

  const ref = `MIG_LOCAL_${Date.now().toString(36).toUpperCase()}`;

  await db.transaction(async (tx) => {
    const currentNgn = await tx.query.wallets.findFirst({
      where: eq(wallets.id, ngnWallet.id),
    });
    const currentLocal = await tx.query.wallets.findFirst({
      where: eq(wallets.id, primary.id),
    });
    if (!currentNgn || !currentLocal) return;

    const stillNgn = Number(currentNgn.balance);
    if (!Number.isFinite(stillNgn) || stillNgn <= 0) return;

    const credit = roundMoney(convertNgnToLocal(stillNgn, fx.ngnToLocal));
    if (credit < 0.01) return;

    const ngnNext = "0.00";
    const localNext = (Number(currentLocal.balance) + credit).toFixed(2);

    await tx.insert(transactions).values({
      userId: input.userId,
      walletId: currentNgn.id,
      type: "debit",
      category: "transfer",
      title: "Migrate to local wallet",
      subtitle: `NGN → ${localCurrency}`,
      amount: stillNgn.toFixed(2),
      currency: "NGN",
      status: "completed",
      balanceAfter: ngnNext,
      externalRef: `${ref}_OUT`,
      metadata: {
        migration: "ngn_to_local_primary",
        countryCode: country,
        localCurrency,
        ngnToLocal: fx.ngnToLocal,
        localAmount: credit,
      },
    });

    await tx.insert(transactions).values({
      userId: input.userId,
      walletId: currentLocal.id,
      type: "credit",
      category: "transfer",
      title: "Local wallet from migration",
      subtitle: `From NGN · rate ${fx.ngnToLocal.toFixed(6)}`,
      amount: credit.toFixed(2),
      currency: localCurrency,
      status: "completed",
      balanceAfter: localNext,
      externalRef: `${ref}_IN`,
      metadata: {
        migration: "ngn_to_local_primary",
        countryCode: country,
        ngnAmount: stillNgn,
        ngnToLocal: fx.ngnToLocal,
      },
    });

    await tx
      .update(wallets)
      .set({
        balance: ngnNext,
        isPrimary: false,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, currentNgn.id));

    await tx
      .update(wallets)
      .set({
        balance: localNext,
        isPrimary: true,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, currentLocal.id));
  });

  return ensurePrimaryWallet(input.userId, localCurrency);
}
