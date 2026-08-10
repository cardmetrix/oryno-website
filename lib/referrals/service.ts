import { and, eq, ne, sql } from "drizzle-orm";
import { referralFromName } from "@/lib/auth/sync-user";
import { currencyForCountry } from "@/lib/country";
import { db } from "@/lib/db";
import {
  referralCodes,
  referralEvents,
  transactions,
  users,
  wallets,
} from "@/lib/db/schema";
import { getUsdMidRate, roundMoney } from "@/lib/fx/rates";
import { createNotification } from "@/lib/notifications-service";
import {
  normalizeReferralCode,
  REFERRAL_BONUS_NGN,
  REFERRAL_MIN_TRANSACTIONS,
} from "@/lib/referrals/config";
import { generateWalletCardNumber } from "@/lib/wallet";

/** Convert a fixed NGN bonus into the user's wallet currency (mid FX, no commission). */
export async function bonusAmountInCurrency(currency: string): Promise<{
  amount: number;
  amountStr: string;
  currency: string;
}> {
  const code = (currency || "NGN").toUpperCase();
  if (code === "NGN") {
    return {
      amount: REFERRAL_BONUS_NGN,
      amountStr: REFERRAL_BONUS_NGN.toFixed(2),
      currency: "NGN",
    };
  }

  const ngn = await getUsdMidRate("NGN");
  const usd = REFERRAL_BONUS_NGN / ngn.midRate;
  const local = await getUsdMidRate(code);
  const amount = roundMoney(usd * local.midRate);
  return {
    amount: Math.max(amount, 0.01),
    amountStr: Math.max(amount, 0.01).toFixed(2),
    currency: code,
  };
}

export async function countQualifyingTransactions(userId: string) {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.status, "completed"),
        ne(transactions.category, "referral"),
      ),
    );
  return row?.count ?? 0;
}

async function creditReferralBonus(input: {
  userId: string;
  amountStr: string;
  currency: string;
  title: string;
  subtitle: string;
  metadata: Record<string, unknown>;
}) {
  return db.transaction(async (tx) => {
    let wallet = await tx.query.wallets.findFirst({
      where: and(
        eq(wallets.userId, input.userId),
        eq(wallets.currency, input.currency),
      ),
    });

    if (!wallet) {
      const [created] = await tx
        .insert(wallets)
        .values({
          userId: input.userId,
          currency: input.currency,
          balance: "0",
          isPrimary: true,
          cardNumber: generateWalletCardNumber(input.userId, input.currency),
        })
        .returning();
      wallet = created;
    }

    if (!wallet) throw new Error("Could not create wallet for referral bonus");

    const nextBalance = (
      Number(wallet.balance) + Number(input.amountStr)
    ).toFixed(2);

    const [txRow] = await tx
      .insert(transactions)
      .values({
        userId: input.userId,
        walletId: wallet.id,
        type: "credit",
        category: "referral",
        title: input.title,
        subtitle: input.subtitle,
        amount: input.amountStr,
        currency: input.currency,
        status: "completed",
        balanceAfter: nextBalance,
        metadata: input.metadata,
      })
      .returning();

    await tx
      .update(wallets)
      .set({ balance: nextBalance, updatedAt: new Date() })
      .where(eq(wallets.id, wallet.id));

    return { transaction: txRow, balanceAfter: nextBalance };
  });
}

/**
 * Attach a referred user to an active referral code.
 * Safe to call repeatedly — no-ops if already attached.
 */
export async function attachReferral(input: {
  referredUserId: string;
  code: string | null | undefined;
}) {
  const code = normalizeReferralCode(input.code);
  if (!code) return { ok: false as const, reason: "missing_code" as const };

  const referred = await db.query.users.findFirst({
    where: eq(users.id, input.referredUserId),
    columns: { id: true, referralCodeId: true, countryCode: true },
  });
  if (!referred) return { ok: false as const, reason: "user_not_found" as const };

  if (referred.referralCodeId) {
    return { ok: false as const, reason: "already_attached" as const };
  }

  const existingEvent = await db.query.referralEvents.findFirst({
    where: eq(referralEvents.referredUserId, input.referredUserId),
    columns: { id: true },
  });
  if (existingEvent) {
    return { ok: false as const, reason: "already_attached" as const };
  }

  const codeRow = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.code, code),
  });
  if (!codeRow || codeRow.status !== "active") {
    return { ok: false as const, reason: "invalid_code" as const };
  }
  if (codeRow.userId === input.referredUserId) {
    return { ok: false as const, reason: "self_referral" as const };
  }

  const currency = currencyForCountry(referred.countryCode);
  const bonus = await bonusAmountInCurrency(currency);

  const [event] = await db
    .insert(referralEvents)
    .values({
      codeId: codeRow.id,
      referrerUserId: codeRow.userId,
      referredUserId: input.referredUserId,
      rewardAmount: bonus.amountStr,
      currency: bonus.currency,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();

  if (!event) {
    return { ok: false as const, reason: "already_attached" as const };
  }

  await db
    .update(users)
    .set({ referralCodeId: codeRow.id, updatedAt: new Date() })
    .where(eq(users.id, input.referredUserId));

  await db
    .update(referralCodes)
    .set({
      joinsCount: sql`${referralCodes.joinsCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(referralCodes.id, codeRow.id));

  try {
    await createNotification({
      userId: codeRow.userId,
      title: "New referral joined",
      body: `Someone signed up with your code ${codeRow.code}. You’ll earn a bonus after they complete ${REFERRAL_MIN_TRANSACTIONS} transactions.`,
      type: "referral",
      metadata: {
        href: "/referrals",
        kind: "referral_join",
        code: codeRow.code,
        referredUserId: input.referredUserId,
      },
    });
  } catch (error) {
    console.error("[referral-join-notify]", error);
  }

  return { ok: true as const, event, code: codeRow.code };
}

/**
 * If the referred user has completed enough transactions, pay both parties
 * ₦2000 (local equivalent) and notify via inbox + email + push.
 */
export async function maybeCompleteReferral(referredUserId: string) {
  const event = await db.query.referralEvents.findFirst({
    where: and(
      eq(referralEvents.referredUserId, referredUserId),
      eq(referralEvents.status, "pending"),
    ),
  });
  if (!event) return { ok: false as const, reason: "no_pending" as const };

  const txCount = await countQualifyingTransactions(referredUserId);
  if (txCount < REFERRAL_MIN_TRANSACTIONS) {
    return {
      ok: false as const,
      reason: "threshold" as const,
      txCount,
      required: REFERRAL_MIN_TRANSACTIONS,
    };
  }

  // Lock by flipping status first (avoid double-pay under concurrency).
  const [locked] = await db
    .update(referralEvents)
    .set({ status: "processing", updatedAt: new Date() })
    .where(
      and(
        eq(referralEvents.id, event.id),
        eq(referralEvents.status, "pending"),
      ),
    )
    .returning();
  if (!locked) {
    return { ok: false as const, reason: "already_processing" as const };
  }

  try {
    const [referrer, referred] = await Promise.all([
      db.query.users.findFirst({
        where: eq(users.id, event.referrerUserId),
        columns: { id: true, countryCode: true, fullName: true },
      }),
      db.query.users.findFirst({
        where: eq(users.id, event.referredUserId),
        columns: { id: true, countryCode: true, fullName: true },
      }),
    ]);
    if (!referrer || !referred) {
      throw new Error("Referral users missing");
    }

    const referrerCurrency = currencyForCountry(referrer.countryCode);
    const referredCurrency = currencyForCountry(referred.countryCode);
    const referrerBonus = await bonusAmountInCurrency(referrerCurrency);
    const referredBonus = await bonusAmountInCurrency(referredCurrency);

    const referrerCredit = await creditReferralBonus({
      userId: referrer.id,
      amountStr: referrerBonus.amountStr,
      currency: referrerBonus.currency,
      title: "Referral bonus",
      subtitle: `Reward for inviting ${referred.fullName.split(" ")[0] || "a friend"}`,
      metadata: {
        kind: "referral_bonus",
        role: "referrer",
        referralEventId: event.id,
        bonusNgn: REFERRAL_BONUS_NGN,
      },
    });

    await creditReferralBonus({
      userId: referred.id,
      amountStr: referredBonus.amountStr,
      currency: referredBonus.currency,
      title: "Referral welcome bonus",
      subtitle: `Bonus for completing ${REFERRAL_MIN_TRANSACTIONS} transactions`,
      metadata: {
        kind: "referral_bonus",
        role: "referred",
        referralEventId: event.id,
        bonusNgn: REFERRAL_BONUS_NGN,
      },
    });

    await db
      .update(referralEvents)
      .set({
        status: "completed",
        rewardAmount: referrerBonus.amountStr,
        currency: referrerBonus.currency,
        transactionId: referrerCredit.transaction.id,
        updatedAt: new Date(),
      })
      .where(eq(referralEvents.id, event.id));

    await db
      .update(referralCodes)
      .set({
        earnings: sql`${referralCodes.earnings} + ${referrerBonus.amountStr}`,
        updatedAt: new Date(),
      })
      .where(eq(referralCodes.id, event.codeId));

    const formatAmt = (amount: string, currency: string) =>
      `${currency} ${Number(amount).toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    await Promise.all([
      createNotification({
        userId: referrer.id,
        title: "Referral bonus paid",
        body: `You earned ${formatAmt(referrerBonus.amountStr, referrerBonus.currency)} because your invite completed ${REFERRAL_MIN_TRANSACTIONS} transactions.`,
        type: "referral",
        metadata: {
          href: "/referrals",
          kind: "referral_bonus",
          role: "referrer",
          amount: referrerBonus.amountStr,
          currency: referrerBonus.currency,
          transactionId: referrerCredit.transaction.id,
        },
        forceEmail: false,
      }),
      createNotification({
        userId: referred.id,
        title: "Referral welcome bonus",
        body: `You received ${formatAmt(referredBonus.amountStr, referredBonus.currency)} for completing ${REFERRAL_MIN_TRANSACTIONS} transactions after joining with a referral.`,
        type: "referral",
        metadata: {
          href: "/wallet",
          kind: "referral_bonus",
          role: "referred",
          amount: referredBonus.amountStr,
          currency: referredBonus.currency,
        },
        forceEmail: false,
      }),
    ]);

    return {
      ok: true as const,
      referrerBonus,
      referredBonus,
      txCount,
    };
  } catch (error) {
    console.error("[referral-complete]", error);
    await db
      .update(referralEvents)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(referralEvents.id, event.id));
    return { ok: false as const, reason: "failed" as const };
  }
}

/** Fire-and-forget check after a qualifying transaction. */
export function scheduleReferralCheck(userId: string) {
  void maybeCompleteReferral(userId).catch((error) => {
    console.error("[referral-check]", error);
  });
}

export async function getOrCreateUserReferralCode(userId: string, fullName: string) {
  const existing = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.userId, userId),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(referralCodes)
    .values({
      userId,
      code: referralFromName(fullName),
    })
    .onConflictDoNothing({ target: referralCodes.userId })
    .returning();

  if (created) return created;

  const again = await db.query.referralCodes.findFirst({
    where: eq(referralCodes.userId, userId),
  });
  if (!again) throw new Error("Could not create referral code");
  return again;
}
