import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  transactions,
  userVirtualNumbers,
  virtualNumberOffers,
  wallets,
} from "@/lib/db/schema";
import { quoteLocalUsd, roundMoney } from "@/lib/fx/rates";
import {
  currencyForCountry,
  ensurePrimaryWallet,
  toWalletSummary,
} from "@/lib/wallet";
import {
  assertHerosmsReady,
  cancelHerosmsEmail,
  getHerosmsEmailStatus,
  getHerosmsNumber,
  getHerosmsStatus,
  herosmsMarkup,
  isHerosmsDemoMode,
  isHerosmsLive,
  purchaseHerosmsEmail,
  setHerosmsStatus,
} from "./client";
import { countryFlagEmoji } from "./countries";
import { herosmsErrorToEnglish, normalizeEmailSite } from "./errors";

const LOG_PREFIX = "[herosms]";

async function debitWallet(input: {
  userId: string;
  countryCode?: string | null;
  amount: number;
  category: "virtual_number" | "other";
  title: string;
  subtitle: string;
  metadata?: Record<string, unknown>;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("Enter a valid amount");
  }

  const currency = currencyForCountry(input.countryCode);
  const wallet = await ensurePrimaryWallet(input.userId, currency);

  if (wallet.status === "frozen" || wallet.status === "closed") {
    throw new Error("Wallet is not available for payments");
  }

  const amountStr = input.amount.toFixed(2);

  return db.transaction(async (tx) => {
    const current = await tx.query.wallets.findFirst({
      where: eq(wallets.id, wallet.id),
    });
    if (!current) throw new Error("Wallet not found");
    if (Number(current.balance) < input.amount) {
      throw new Error("Insufficient wallet balance");
    }

    const next = (Number(current.balance) - input.amount).toFixed(2);
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
        currency,
        status: "processing",
        balanceAfter: next,
        metadata: {
          provider: "herosms",
          ...(input.metadata ?? {}),
        },
      })
      .returning();

    return {
      wallet: updated ?? { ...current, balance: next },
      transaction: txRow,
      amount: input.amount,
      currency,
    };
  });
}

async function refundDebit(input: {
  walletId: string;
  transactionId: string;
  amount: number;
  reason: string;
}) {
  await db.transaction(async (tx) => {
    const wallet = await tx.query.wallets.findFirst({
      where: eq(wallets.id, input.walletId),
    });
    if (wallet) {
      const restored = (Number(wallet.balance) + input.amount).toFixed(2);
      await tx
        .update(wallets)
        .set({ balance: restored, updatedAt: new Date() })
        .where(eq(wallets.id, wallet.id));
    }
    await tx
      .update(transactions)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: { failureReason: input.reason },
      })
      .where(eq(transactions.id, input.transactionId));
  });
}

export async function usdToLocalPrice(
  usd: number,
  countryCode?: string | null,
) {
  const currency = currencyForCountry(countryCode);
  const quote = await quoteLocalUsd(currency);
  const local = roundMoney(usd * quote.buyRate * herosmsMarkup());
  return { local, currency, quote };
}

async function ensureOffer(input: {
  countryCode: string;
  countryName: string;
  iso?: string | null;
  service: string;
  serviceName: string;
  price: number;
  currency: string;
}) {
  const category = `${input.serviceName} · SMS`.slice(0, 80);
  const existing = await db.query.virtualNumberOffers.findFirst({
    where: and(
      eq(virtualNumberOffers.countryCode, input.countryCode),
      eq(virtualNumberOffers.category, category),
      eq(virtualNumberOffers.type, "rent"),
    ),
  });
  if (existing) return existing;

  const [created] = await db
    .insert(virtualNumberOffers)
    .values({
      countryCode: input.countryCode.slice(0, 2).toUpperCase(),
      countryName: input.countryName.slice(0, 120),
      flagEmoji: input.iso ? countryFlagEmoji(input.iso) : "🏳️",
      type: "rent",
      category,
      price: input.price.toFixed(2),
      currency: input.currency,
      duration: "Until SMS / ~20 min",
      smsCapable: true,
      stockBuy: 0,
      stockRent: 100,
      active: true,
    })
    .returning();

  return created;
}

export async function purchaseVirtualNumber(input: {
  userId: string;
  countryCode?: string | null;
  heroCountryId: number;
  countryName: string;
  iso?: string | null;
  service: string;
  serviceName: string;
  priceUsd: number;
  priceLocal: number;
}) {
  const { local, currency } = await usdToLocalPrice(
    input.priceUsd,
    input.countryCode,
  );
  // Prefer client-quoted local if close; else recompute
  const chargeAmount =
    input.priceLocal > 0 ? input.priceLocal : local;

  const offer = await ensureOffer({
    countryCode: (input.iso || input.countryCode || "NG").slice(0, 2).toUpperCase(),
    countryName: input.countryName,
    iso: input.iso,
    service: input.service,
    serviceName: input.serviceName,
    price: chargeAmount,
    currency,
  });

  if (!offer?.id) {
    throw new Error("Unable to prepare this number offer. Please try again.");
  }

  console.log(LOG_PREFIX, "purchase number start", {
    live: isHerosmsLive(),
    service: input.service,
    heroCountryId: input.heroCountryId,
    priceUsd: input.priceUsd,
    chargeAmount,
    currency,
  });

  // Fail before debiting wallet when live provider is down / empty
  if (!isHerosmsDemoMode()) {
    await assertHerosmsReady(Math.max(0.01, input.priceUsd * 0.5));
  }

  const prepared = await debitWallet({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: chargeAmount,
    category: "virtual_number",
    title: `${input.serviceName} number`,
    subtitle: input.countryName,
    metadata: {
      service: input.service,
      heroCountryId: input.heroCountryId,
      priceUsd: input.priceUsd,
    },
  });

  try {
    let activationId: string;
    let phoneNumber: string;
    let simulated = false;

    if (isHerosmsDemoMode()) {
      simulated = true;
      activationId = `demo_${Date.now()}`;
      phoneNumber = `+23480${String(Date.now()).slice(-8)}`;
      console.log(LOG_PREFIX, "purchase number DEMO", {
        activationId,
        phoneNumber,
      });
    } else {
      const num = await getHerosmsNumber({
        service: input.service,
        country: input.heroCountryId,
        maxPrice: input.priceUsd * 1.25,
      });
      activationId = num.activationId;
      phoneNumber = num.phoneNumber;
      console.log(LOG_PREFIX, "purchase number LIVE", {
        activationId,
        phoneNumber,
      });
      // Mark ready to receive SMS
      try {
        await setHerosmsStatus(activationId, 1);
      } catch (e) {
        console.warn(LOG_PREFIX, "setStatus(1) non-fatal", e);
      }
    }

    const [row] = await db
      .insert(userVirtualNumbers)
      .values({
        userId: input.userId,
        offerId: offer.id,
        phoneNumber,
        type: "rent",
        status: "processing",
        expiresAt: new Date(Date.now() + 20 * 60 * 1000),
        transactionId: prepared.transaction.id,
      })
      .returning();

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: activationId,
        relatedOrderId: row.id,
        relatedOrderType: "virtual_number",
        updatedAt: new Date(),
        metadata: {
          provider: "herosms",
          activationId,
          phoneNumber,
          service: input.service,
          simulated,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

    return {
      number: row,
      phoneNumber,
      activationId,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      amount: chargeAmount,
      currency,
      simulated,
    };
  } catch (error) {
    const reason = herosmsErrorToEnglish(
      error instanceof Error ? error.message : "Purchase failed",
    );
    console.error(LOG_PREFIX, "purchase number failed — refunding", reason);
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    throw new Error(reason);
  }
}

export async function purchaseEmailActivation(input: {
  userId: string;
  countryCode?: string | null;
  site: string;
  domain: string;
  service?: string;
  priceUsd: number;
  priceLocal?: number;
}) {
  const { local, currency } = await usdToLocalPrice(
    input.priceUsd,
    input.countryCode,
  );
  const chargeAmount =
    input.priceLocal && input.priceLocal > 0 ? input.priceLocal : local;

  const site = normalizeEmailSite(input.site);
  const domain = input.domain.trim().toLowerCase().replace(/^@/, "");
  if (!site || !domain) {
    throw new Error("Site and domain are required");
  }

  console.log(LOG_PREFIX, "purchase email start", {
    live: isHerosmsLive(),
    site,
    domain,
    service: input.service,
    priceUsd: input.priceUsd,
    chargeAmount,
    currency,
  });

  if (!isHerosmsDemoMode()) {
    await assertHerosmsReady(Math.max(0.01, input.priceUsd * 0.5));
  }

  const prepared = await debitWallet({
    userId: input.userId,
    countryCode: input.countryCode,
    amount: chargeAmount,
    category: "other",
    title: "Temporary email",
    subtitle: `${domain} · ${site}`,
    metadata: {
      kind: "email_rental",
      site,
      domain,
      priceUsd: input.priceUsd,
    },
  });

  try {
    let emailId: string;
    let email: string;
    let simulated = false;

    if (isHerosmsDemoMode()) {
      simulated = true;
      emailId = `demo_email_${Date.now()}`;
      const localPart = `oryno${String(Date.now()).slice(-6)}`;
      email = `${localPart}@${domain}`;
      console.log(LOG_PREFIX, "purchase email DEMO", { emailId, email });
    } else {
      // OpenAPI: POST /emails body is { site, domain } only
      const bought = await purchaseHerosmsEmail({ site, domain });
      emailId = bought.emailId;
      email = bought.email;
      console.log(LOG_PREFIX, "purchase email LIVE", { emailId, email });
    }

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: emailId,
        relatedOrderType: "email_rental",
        updatedAt: new Date(),
        metadata: {
          provider: "herosms",
          kind: "email_rental",
          emailId,
          email,
          site,
          domain,
          simulated,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

    return {
      emailId,
      email,
      site,
      domain,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      amount: chargeAmount,
      currency,
      simulated,
    };
  } catch (error) {
    const reason = herosmsErrorToEnglish(
      error instanceof Error ? error.message : "Purchase failed",
    );
    console.error(LOG_PREFIX, "purchase email failed — refunding", reason);
    await refundDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    throw new Error(reason);
  }
}

export async function pollNumberStatus(activationId: string) {
  if (activationId.startsWith("demo_") || isHerosmsDemoMode()) {
    console.log(LOG_PREFIX, "poll number DEMO", { activationId });
    return {
      status: "STATUS_OK" as const,
      code: "482913",
      demo: true,
    };
  }
  console.log(LOG_PREFIX, "poll number LIVE", { activationId });
  return getHerosmsStatus(activationId);
}

export async function pollEmailStatus(emailId: string) {
  if (emailId.startsWith("demo_") || isHerosmsDemoMode()) {
    console.log(LOG_PREFIX, "poll email DEMO", { emailId });
    return {
      id: emailId,
      status: "OK",
      value: "482913",
      message: "Your verification code is 482913",
      demo: true,
    };
  }
  console.log(LOG_PREFIX, "poll email LIVE", { emailId });
  return getHerosmsEmailStatus(emailId);
}

export async function cancelEmail(emailId: string) {
  if (emailId.startsWith("demo_") || isHerosmsDemoMode()) {
    console.log(LOG_PREFIX, "cancel email DEMO", { emailId });
    return { ok: true, demo: true };
  }
  console.log(LOG_PREFIX, "cancel email LIVE", { emailId });
  return cancelHerosmsEmail(emailId);
}
