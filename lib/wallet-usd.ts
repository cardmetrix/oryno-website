import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  walletFundings,
  wallets,
} from "@/lib/db/schema";
import {
  localFromSellUsd,
  localToBuyUsd,
  quoteLocalUsd,
  roundMoney,
  usdFromLocal,
} from "@/lib/fx/rates";
import { formatMoney } from "@/lib/transactions";
import {
  generateWalletCardNumber,
  toWalletSummary,
  type WalletRow,
} from "@/lib/wallet";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
  paystackFetch,
} from "@/lib/paystack/client";

export async function ensureUsdWallet(userId: string): Promise<WalletRow> {
  const existing = await db.query.wallets.findFirst({
    where: and(eq(wallets.userId, userId), eq(wallets.currency, "USD")),
  });
  if (existing) return existing;

  const cardNumber = generateWalletCardNumber(userId, "USD");
  try {
    const [created] = await db
      .insert(wallets)
      .values({
        userId,
        currency: "USD",
        balance: "0",
        isPrimary: false,
        cardNumber,
      })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
  } catch (error) {
    console.error("[ensure-usd-wallet]", error);
  }

  const again = await db.query.wallets.findFirst({
    where: and(eq(wallets.userId, userId), eq(wallets.currency, "USD")),
  });
  if (!again) throw new Error("Unable to create USD wallet");
  return again;
}

type UsdDebitCategory = "virtual_number" | "social" | "other";

/**
 * Debit the user's USD card/wallet for USD-priced services (numbers, boosting).
 */
export async function debitUsdWallet(input: {
  userId: string;
  amount: number;
  category: UsdDebitCategory;
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const amount = roundMoney(input.amount);
  const wallet = await ensureUsdWallet(input.userId);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("USD card is not available for payments");
  }

  const amountStr = amount.toFixed(2);

  return db.transaction(async (tx) => {
    const current = await tx.query.wallets.findFirst({
      where: eq(wallets.id, wallet.id),
    });
    if (!current) throw new Error("USD wallet not found");
    if (Number(current.balance) < amount) {
      throw new Error(
        "Insufficient USD card balance. Fund your USD wallet to continue.",
      );
    }

    const next = (Number(current.balance) - amount).toFixed(2);
    const [updated] = await tx
      .update(wallets)
      .set({ balance: next, updatedAt: new Date() })
      .where(eq(wallets.id, current.id))
      .returning();

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: current.id,
        type: "debit",
        category: input.category,
        title: input.title,
        subtitle: input.subtitle,
        amount: amountStr,
        currency: "USD",
        status: "processing",
        balanceAfter: next,
        metadata: {
          chargedFrom: "usd_wallet",
          ...(input.metadata ?? {}),
        },
      })
      .returning();

    return {
      wallet: updated ?? { ...current, balance: next },
      transaction: txRow,
      amount,
      currency: "USD" as const,
    };
  });
}

function parseAmount(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return roundMoney(n);
}

/**
 * Convert between local primary wallet and USD wallet.
 * direction: to_usd | to_local
 * amount: source amount (local when to_usd, USD when to_local)
 */
export async function convertWalletCurrency(input: {
  userId: string;
  localCurrency: string;
  direction: "to_usd" | "to_local";
  amount: string | number;
}) {
  const amount = parseAmount(input.amount);
  const localCurrency = input.localCurrency.toUpperCase();
  if (localCurrency === "USD") {
    throw new Error("Local currency wallet is already USD.");
  }

  const quote = await quoteLocalUsd(localCurrency);
  const localWallet = await db.query.wallets.findFirst({
    where: and(
      eq(wallets.userId, input.userId),
      eq(wallets.currency, localCurrency),
    ),
  });
  if (!localWallet) throw new Error("Local wallet not found.");
  if (localWallet.status !== "healthy") {
    throw new Error("Local wallet is not available.");
  }

  const usdWallet = await ensureUsdWallet(input.userId);
  if (usdWallet.status !== "healthy") {
    throw new Error("USD wallet is not available.");
  }

  if (input.direction === "to_usd") {
    const usdCredit = usdFromLocal(amount, quote.buyRate);
    if (usdCredit < 0.01) {
      throw new Error("Amount is too small after conversion.");
    }
    if (Number(localWallet.balance) < amount) {
      throw new Error("Insufficient local wallet balance.");
    }

    const localNext = (Number(localWallet.balance) - amount).toFixed(2);
    const usdNext = (Number(usdWallet.balance) + usdCredit).toFixed(2);
    const ref = `FX_${Date.now().toString(36).toUpperCase()}`;

    return db.transaction(async (tx) => {
      const [debitTx] = await tx
        .insert(transactions)
        .values({
          userId: input.userId,
          walletId: localWallet.id,
          type: "debit",
          category: "transfer",
          title: "Convert to USD",
          subtitle: `${formatMoney(amount, localCurrency)} → ${formatMoney(usdCredit, "USD")}`,
          amount: amount.toFixed(2),
          currency: localCurrency,
          status: "completed",
          balanceAfter: localNext,
          externalRef: `${ref}_OUT`,
          metadata: {
            direction: "to_usd",
            midRate: quote.midRate,
            appliedRate: quote.buyRate,
            commissionPercent: quote.commissionPercent,
            usdAmount: usdCredit,
            provider: quote.provider,
          },
        })
        .returning();

      const [creditTx] = await tx
        .insert(transactions)
        .values({
          userId: input.userId,
          walletId: usdWallet.id,
          type: "credit",
          category: "transfer",
          title: "USD from conversion",
          subtitle: `From ${localCurrency} · rate ${quote.buyRate.toFixed(4)}`,
          amount: usdCredit.toFixed(2),
          currency: "USD",
          status: "completed",
          balanceAfter: usdNext,
          externalRef: `${ref}_IN`,
          metadata: {
            direction: "to_usd",
            relatedTransactionId: debitTx.id,
            midRate: quote.midRate,
            appliedRate: quote.buyRate,
            commissionPercent: quote.commissionPercent,
            localAmount: amount,
            provider: quote.provider,
          },
        })
        .returning();

      await tx
        .update(wallets)
        .set({ balance: localNext, updatedAt: new Date() })
        .where(eq(wallets.id, localWallet.id));
      await tx
        .update(wallets)
        .set({ balance: usdNext, updatedAt: new Date() })
        .where(eq(wallets.id, usdWallet.id));

      return {
        direction: "to_usd" as const,
        quote,
        fromAmount: amount,
        fromCurrency: localCurrency,
        toAmount: usdCredit,
        toCurrency: "USD" as const,
        debitTransactionId: debitTx.id,
        creditTransactionId: creditTx.id,
        localWallet: toWalletSummary({ ...localWallet, balance: localNext }),
        usdWallet: toWalletSummary({ ...usdWallet, balance: usdNext }),
      };
    });
  }

  // to_local
  const localCredit = localFromSellUsd(amount, quote.sellRate);
  if (localCredit < 0.01) {
    throw new Error("Amount is too small after conversion.");
  }
  if (Number(usdWallet.balance) < amount) {
    throw new Error("Insufficient USD wallet balance.");
  }

  const usdNext = (Number(usdWallet.balance) - amount).toFixed(2);
  const localNext = (Number(localWallet.balance) + localCredit).toFixed(2);
  const ref = `FX_${Date.now().toString(36).toUpperCase()}`;

  return db.transaction(async (tx) => {
    const [debitTx] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: usdWallet.id,
        type: "debit",
        category: "transfer",
        title: "Convert from USD",
        subtitle: `${formatMoney(amount, "USD")} → ${formatMoney(localCredit, localCurrency)}`,
        amount: amount.toFixed(2),
        currency: "USD",
        status: "completed",
        balanceAfter: usdNext,
        externalRef: `${ref}_OUT`,
        metadata: {
          direction: "to_local",
          midRate: quote.midRate,
          appliedRate: quote.sellRate,
          commissionPercent: quote.commissionPercent,
          localAmount: localCredit,
          provider: quote.provider,
        },
      })
      .returning();

    const [creditTx] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: localWallet.id,
        type: "credit",
        category: "transfer",
        title: "Local from USD",
        subtitle: `From USD · rate ${quote.sellRate.toFixed(4)}`,
        amount: localCredit.toFixed(2),
        currency: localCurrency,
        status: "completed",
        balanceAfter: localNext,
        externalRef: `${ref}_IN`,
        metadata: {
          direction: "to_local",
          relatedTransactionId: debitTx.id,
          midRate: quote.midRate,
          appliedRate: quote.sellRate,
          commissionPercent: quote.commissionPercent,
          usdAmount: amount,
          provider: quote.provider,
        },
      })
      .returning();

    await tx
      .update(wallets)
      .set({ balance: usdNext, updatedAt: new Date() })
      .where(eq(wallets.id, usdWallet.id));
    await tx
      .update(wallets)
      .set({ balance: localNext, updatedAt: new Date() })
      .where(eq(wallets.id, localWallet.id));

    return {
      direction: "to_local" as const,
      quote,
      fromAmount: amount,
      fromCurrency: "USD" as const,
      toAmount: localCredit,
      toCurrency: localCurrency,
      debitTransactionId: debitTx.id,
      creditTransactionId: creditTx.id,
      localWallet: toWalletSummary({ ...localWallet, balance: localNext }),
      usdWallet: toWalletSummary({ ...usdWallet, balance: usdNext }),
    };
  });
}

type InitPaystackData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export async function initiateUsdPaystackFund(input: {
  userId: string;
  email: string;
  localCurrency: string;
  usdAmount: string | number;
  callbackUrl: string;
}) {
  const usdAmount = parseAmount(input.usdAmount);
  const localCurrency = input.localCurrency.toUpperCase();
  const quote = await quoteLocalUsd(localCurrency);
  const localAmount = localToBuyUsd(usdAmount, quote.buyRate);
  const usdWallet = await ensureUsdWallet(input.userId);
  const reference = `USD_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  await db.insert(walletFundings).values({
    userId: input.userId,
    walletId: usdWallet.id,
    amount: usdAmount.toFixed(2),
    currency: "USD",
    method: "card",
    status: "pending",
    externalRef: reference,
    metadata: {
      purpose: "usd_fund",
      localCurrency,
      localAmount,
      midRate: quote.midRate,
      buyRate: quote.buyRate,
      commissionPercent: quote.commissionPercent,
      provider: quote.provider,
    },
  });

  // Demo / no keys: credit immediately
  if (!hasPaystackKeys() || isPaystackDemoMode()) {
    // Still try real Paystack in test mode; if it fails, fall through to demo credit below after initialize attempt
  }

  if (hasPaystackKeys()) {
    try {
      // Paystack NG settles in NGN for most accounts
      const chargeCurrency = localCurrency === "NGN" ? "NGN" : "NGN";
      const chargeAmount =
        localCurrency === "NGN"
          ? localAmount
          : localToBuyUsd(usdAmount, (await quoteLocalUsd("NGN")).buyRate);

      const res = await paystackFetch<InitPaystackData>(
        "/transaction/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            email: input.email,
            amount: Math.round(chargeAmount * 100),
            currency: chargeCurrency,
            reference,
            callback_url: input.callbackUrl,
            metadata: {
              oryno_user_id: input.userId,
              purpose: "usd_fund",
              usd_amount: usdAmount,
              local_currency: localCurrency,
              local_amount: localAmount,
              buy_rate: quote.buyRate,
            },
          }),
        },
      );

      return {
        mode: "paystack" as const,
        reference,
        authorizationUrl: res.data.authorization_url,
        accessCode: res.data.access_code,
        usdAmount,
        localAmount,
        localCurrency,
        quote,
        demoMode: isPaystackDemoMode(),
      };
    } catch (error) {
      throw error;
    }
  }

  throw new Error(
    "Paystack is not configured for live USD funding. Set PAYSTACK_SECRET_KEY.",
  );
}

export async function creditUsdWalletFromFunding(input: {
  userId: string;
  reference: string;
  usdAmount?: number;
}) {
  const funding = await db.query.walletFundings.findFirst({
    where: eq(walletFundings.externalRef, input.reference),
  });
  if (!funding) throw new Error("Funding reference not found.");
  if (funding.userId !== input.userId) {
    throw new Error("Funding does not belong to this user.");
  }
  if (funding.status === "completed" && funding.transactionId) {
    const usdWallet = await ensureUsdWallet(input.userId);
    return {
      duplicated: true as const,
      transactionId: funding.transactionId,
      usdWallet: toWalletSummary(usdWallet),
    };
  }

  const usdAmount = input.usdAmount ?? Number(funding.amount);
  const usdWallet = await ensureUsdWallet(input.userId);
  const next = (Number(usdWallet.balance) + usdAmount).toFixed(2);

  const result = await db.transaction(async (tx) => {
    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: usdWallet.id,
        type: "credit",
        category: "fund",
        title: "Fund USD wallet",
        subtitle: funding.metadata
          ? `Paystack · ${String((funding.metadata as { localCurrency?: string }).localCurrency ?? "NGN")}`
          : "Paystack USD fund",
        amount: usdAmount.toFixed(2),
        currency: "USD",
        status: "completed",
        balanceAfter: next,
        externalRef: input.reference,
        metadata: {
          purpose: "usd_fund",
          ...(funding.metadata ?? {}),
        },
      })
      .returning();

    await tx
      .update(wallets)
      .set({ balance: next, updatedAt: new Date() })
      .where(eq(wallets.id, usdWallet.id));

    await tx
      .update(walletFundings)
      .set({
        status: "completed",
        transactionId: txRow.id,
        updatedAt: new Date(),
      })
      .where(eq(walletFundings.id, funding.id));

    return { transactionId: txRow.id };
  });

  return {
    duplicated: false as const,
    transactionId: result.transactionId,
    usdWallet: toWalletSummary({ ...usdWallet, balance: next }),
    amountFormatted: formatMoney(usdAmount, "USD"),
  };
}

export async function verifyUsdPaystackFund(input: {
  userId: string;
  reference: string;
}) {
  if (!hasPaystackKeys()) {
    return creditUsdWalletFromFunding(input);
  }

  type VerifyData = {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    metadata?: Record<string, unknown> | null;
  };

  const res = await paystackFetch<VerifyData>(
    `/transaction/verify/${encodeURIComponent(input.reference)}`,
  );

  if (res.data.status !== "success") {
    throw new Error("Payment not successful yet.");
  }

  const meta = res.data.metadata ?? {};
  const purpose = meta.purpose ?? meta.Purpose;
  if (purpose && purpose !== "usd_fund") {
    throw new Error("This payment is not a USD wallet funding.");
  }

  const funding = await db.query.walletFundings.findFirst({
    where: eq(walletFundings.externalRef, input.reference),
  });
  const usdAmount = funding
    ? Number(funding.amount)
    : Number(meta.usd_amount ?? 0);

  if (!usdAmount || usdAmount <= 0) {
    throw new Error("Missing USD amount on payment.");
  }

  return creditUsdWalletFromFunding({
    userId: input.userId,
    reference: input.reference,
    usdAmount,
  });
}
