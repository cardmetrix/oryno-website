/**
 * AnyMessage email rental purchase + status polling.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { roundMoney } from "@/lib/fx/rates";
import { quoteLocalUsd } from "@/lib/fx/customer-quote";
import {
  priceUsdToLocal,
  usdFromLocalRetail,
} from "@/lib/pricing/service-pricing";
import { notifyServiceEvent } from "@/lib/notify/service-events";
import { currencyForCountry, toWalletSummary } from "@/lib/wallet";
import { debitUsdWallet } from "@/lib/wallet-usd";
import { refundFailedDebit } from "@/lib/wallet/ledger";
import {
  anymessageErrorToEnglish,
  assertAnymessageReady,
  cancelAnymessageEmail,
  getAnymessageEmailMessage,
  isAnymessageDemoMode,
  isAnymessageLive,
  normalizeEmailSite,
  purchaseAnymessageEmail,
} from "./client";

const LOG_PREFIX = "[anymessage-purchase]";

async function usdRetailEmailPrice(
  usd: number,
  countryCode?: string | null,
  serviceKey?: string | null,
) {
  const currency = currencyForCountry(countryCode);
  const quote = await quoteLocalUsd(currency);
  // Admin markup key remains `herosms` for numbers/emails catalog.
  const priced = await priceUsdToLocal({
    provider: "herosms",
    serviceKey,
    usd,
    buyRate: quote.buyRate,
    source: "email",
  });
  return {
    usd: usdFromLocalRetail(priced.local, quote.buyRate),
    local: priced.local,
    currency: "USD" as const,
    localCurrency: currency,
    quote,
    markup: priced.markup,
    companyCharge: priced.companyCharge,
  };
}

export async function purchaseEmailActivation(input: {
  userId: string;
  countryCode?: string | null;
  site: string;
  domain: string;
  /** Wholesale USD from AnyMessage (preferred for markup). */
  costUsd?: number;
  /** Retail USD charged to the customer. */
  priceUsd: number;
  priceLocal?: number;
}) {
  if (isAnymessageDemoMode()) {
    throw new Error(
      "Email rental is not configured for live. Set ANYMESSAGE_API_TOKEN and ANYMESSAGE_DEMO=false.",
    );
  }

  const site = normalizeEmailSite(input.site);
  const domain = input.domain.trim().toLowerCase().replace(/^@/, "");
  if (!site || !domain) throw new Error("Site and domain are required");

  const wholesaleUsd =
    Number.isFinite(input.costUsd) && (input.costUsd as number) > 0
      ? (input.costUsd as number)
      : Number.isFinite(input.priceUsd) && input.priceUsd > 0
        ? input.priceUsd
        : 0.05;
  const serviceKey = `email:${site}:${domain}`;
  const priced = await usdRetailEmailPrice(
    wholesaleUsd,
    input.countryCode,
    serviceKey,
  );
  // Prefer client retail when it matches our computed retail (±2¢), else recompute.
  const chargeAmount =
    Number.isFinite(input.priceUsd) &&
    input.priceUsd > 0 &&
    Math.abs(input.priceUsd - priced.usd) <= 0.02
      ? roundMoney(input.priceUsd)
      : priced.usd;
  const { quote, companyCharge } = priced;

  console.log(LOG_PREFIX, "purchase start", {
    live: isAnymessageLive(),
    site,
    domain,
    wholesaleUsd,
    chargeAmount,
  });

  await assertAnymessageReady(Math.max(0.01, wholesaleUsd * 0.5));

  const prepared = await debitUsdWallet({
    userId: input.userId,
    amount: chargeAmount,
    category: "other",
    title: "Temporary email",
    subtitle: `${domain} · ${site}`,
    metadata: {
      provider: "anymessage",
      kind: "email_rental",
      site,
      domain,
      costUsd: wholesaleUsd,
      priceUsd: chargeAmount,
      priceLocal: priced.local,
      buyRate: quote.buyRate,
    },
  });

  try {
    const bought = await purchaseAnymessageEmail({ site, domain });
    console.log(LOG_PREFIX, "purchase LIVE", {
      emailId: bought.emailId,
      email: bought.email,
    });

    await db
      .update(transactions)
      .set({
        status: "completed",
        externalRef: bought.emailId.slice(0, 120),
        relatedOrderType: "email_rental",
        updatedAt: new Date(),
        metadata: {
          provider: "anymessage",
          kind: "email_rental",
          emailId: bought.emailId,
          email: bought.email,
          site,
          domain,
        },
      })
      .where(eq(transactions.id, prepared.transaction.id));

    const { scheduleReferralCheck } = await import("@/lib/referrals/service");
    scheduleReferralCheck(input.userId);

    try {
      const { recognizeUsdServiceProfit } = await import(
        "@/lib/company/recognize"
      );
      const chargeUsd = roundMoney(
        companyCharge > 0 ? companyCharge / quote.buyRate : 0,
      );
      await recognizeUsdServiceProfit({
        source: "email",
        transactionId: prepared.transaction.id,
        userId: input.userId,
        customerUsd: chargeAmount,
        providerUsd: wholesaleUsd,
        chargeUsd: Math.max(0, chargeUsd),
        description: `Email rental ${domain}`,
        metadata: { provider: "anymessage", site, domain },
      });
    } catch (revenueError) {
      console.error("[anymessage-email-revenue]", revenueError);
    }

    return {
      emailId: bought.emailId,
      email: bought.email,
      site,
      domain,
      transactionId: prepared.transaction.id,
      wallet: toWalletSummary(prepared.wallet),
      amount: chargeAmount,
      currency: "USD" as const,
      simulated: false,
    };
  } catch (error) {
    const reason = anymessageErrorToEnglish(
      error instanceof Error ? error.message : "Purchase failed",
    );
    console.error(LOG_PREFIX, "purchase failed — refunding", reason);
    await refundFailedDebit({
      walletId: prepared.wallet.id,
      transactionId: prepared.transaction.id,
      amount: prepared.amount,
      reason,
    });
    throw new Error(reason);
  }
}

export async function pollEmailStatus(emailId: string, userId?: string) {
  if (isAnymessageDemoMode()) {
    throw new Error(
      "Email rental is not configured for live. Set ANYMESSAGE_API_TOKEN and ANYMESSAGE_DEMO=false.",
    );
  }

  try {
    const status = await getAnymessageEmailMessage(emailId);
    const code = status.value || null;
    const message = status.message?.trim() || null;

    if (code) {
      await maybeNotifyEmailCode(emailId, code, userId);
    }

    return {
      value: code,
      code,
      message,
      status: code ? "OK" : status.status || "PENDING",
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const lower = raw.toLowerCase();
    if (lower.includes("wait message") || lower.includes("waiting")) {
      return {
        value: null,
        code: null,
        message: null,
        status: "PENDING",
      };
    }
    throw error;
  }
}

export async function cancelEmail(emailId: string) {
  if (isAnymessageDemoMode()) {
    throw new Error(
      "Email rental is not configured for live. Set ANYMESSAGE_API_TOKEN and ANYMESSAGE_DEMO=false.",
    );
  }
  return cancelAnymessageEmail(emailId);
}

async function findServiceTx(externalRef: string, userId?: string) {
  const ref = externalRef.slice(0, 120);
  return db.query.transactions.findFirst({
    where: userId
      ? and(eq(transactions.externalRef, ref), eq(transactions.userId, userId))
      : eq(transactions.externalRef, ref),
  });
}

async function maybeNotifyEmailCode(
  emailId: string,
  code: string,
  userId?: string,
) {
  const tx = await findServiceTx(emailId, userId);
  if (!tx) return;
  const meta = (tx.metadata || {}) as Record<string, unknown>;
  if (meta.completionNotifiedAt) return;

  await db
    .update(transactions)
    .set({
      metadata: {
        ...meta,
        completionNotifiedAt: new Date().toISOString(),
        emailCode: code,
      },
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, tx.id));

  const email =
    typeof meta.email === "string" ? meta.email : "your temporary email";
  await notifyServiceEvent({
    userId: tx.userId,
    title: "Email code received",
    body: `Code for ${email}: ${code}`,
    type: "email",
    href: "/services/emails",
    metadata: { emailId, transactionId: tx.id, provider: "anymessage" },
  });
}
