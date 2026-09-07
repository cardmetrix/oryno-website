import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  companyBalances,
  companyPayouts,
  companyRevenueEntries,
} from "@/lib/db/schema";
import { getUsdMidRate, roundMoney } from "@/lib/fx/rates";
import type { CompanyChargeSource } from "@/lib/company/charges";

export type RevenueSource = CompanyChargeSource;

export type RecognizeRevenueInput = {
  source: RevenueSource;
  transactionId?: string | null;
  userId?: string | null;
  currency: string;
  grossIn: number;
  grossOut: number;
  markupAmount?: number;
  chargeAmount?: number;
  fxSpreadAmount?: number;
  description?: string;
  metadata?: Record<string, unknown>;
};

async function profitToNgn(amount: number, currency: string) {
  const code = currency.toUpperCase();
  if (code === "NGN") return roundMoney(amount);
  if (amount === 0) return 0;
  const { midRate } = await getUsdMidRate(code === "USD" ? "NGN" : code);
  if (code === "USD") return roundMoney(amount * midRate);
  const ngn = await getUsdMidRate("NGN");
  return roundMoney((amount / midRate) * ngn.midRate);
}

type LedgerClient = {
  query: typeof db.query;
  insert: typeof db.insert;
};

async function ensureBalanceRow(tx: LedgerClient, currency: string) {
  const code = currency.toUpperCase();
  const existing = await tx.query.companyBalances.findFirst({
    where: eq(companyBalances.currency, code),
  });
  if (existing) return existing;
  const [created] = await tx
    .insert(companyBalances)
    .values({
      currency: code,
      available: "0",
      reserved: "0",
      lifetimeRecognized: "0",
      lifetimeWithdrawn: "0",
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const again = await tx.query.companyBalances.findFirst({
    where: eq(companyBalances.currency, code),
  });
  if (!again) throw new Error("Unable to open company ledger");
  return again;
}

export async function recognizeRevenue(input: RecognizeRevenueInput) {
  const currency = input.currency.toUpperCase();
  const grossIn = roundMoney(Math.max(0, input.grossIn));
  const grossOut = roundMoney(Math.max(0, input.grossOut));
  const profitAmount = roundMoney(grossIn - grossOut);
  if (profitAmount <= 0 && !input.transactionId) return null;
  if (profitAmount === 0) return null;

  const profitNgn = await profitToNgn(profitAmount, currency);

  try {
    return await db.transaction(async (tx) => {
      if (input.transactionId) {
        const existing = await tx.query.companyRevenueEntries.findFirst({
          where: eq(companyRevenueEntries.transactionId, input.transactionId),
        });
        if (existing) {
          if (existing.status === "recognized") return existing;
          return existing;
        }
      }

      const [entry] = await tx
        .insert(companyRevenueEntries)
        .values({
          source: input.source,
          status: "recognized",
          transactionId: input.transactionId ?? null,
          userId: input.userId ?? null,
          currency,
          grossIn: grossIn.toFixed(2),
          grossOut: grossOut.toFixed(2),
          markupAmount: roundMoney(input.markupAmount ?? 0).toFixed(2),
          chargeAmount: roundMoney(input.chargeAmount ?? 0).toFixed(2),
          fxSpreadAmount: roundMoney(input.fxSpreadAmount ?? 0).toFixed(2),
          profitAmount: profitAmount.toFixed(2),
          profitNgn: profitNgn.toFixed(2),
          description: (input.description || input.source).slice(0, 255),
          metadata: input.metadata ?? null,
          recognizedAt: new Date(),
        })
        .returning();

      const balance = await ensureBalanceRow(tx, currency);
      const nextAvailable = roundMoney(Number(balance.available) + profitAmount);
      const nextLifetime = roundMoney(
        Number(balance.lifetimeRecognized) + profitAmount,
      );
      await tx
        .update(companyBalances)
        .set({
          available: nextAvailable.toFixed(2),
          lifetimeRecognized: nextLifetime.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(companyBalances.currency, currency));

      return entry;
    });
  } catch (error) {
    console.error("[company-revenue-recognize]", error);
    return null;
  }
}

export async function recognizeRevenueSafe(input: RecognizeRevenueInput) {
  try {
    return await recognizeRevenue(input);
  } catch (error) {
    console.error("[company-revenue-safe]", error);
    return null;
  }
}

export async function reverseRevenue(transactionId: string) {
  if (!transactionId) return { ok: true as const, already: true as const };

  try {
    return await db.transaction(async (tx) => {
      const entry = await tx.query.companyRevenueEntries.findFirst({
        where: eq(companyRevenueEntries.transactionId, transactionId),
      });
      if (!entry) return { ok: true as const, already: true as const };
      if (entry.status === "reversed") {
        return { ok: true as const, already: true as const };
      }

      const profit = Number(entry.profitAmount);
      const currency = entry.currency;
      const balance = await ensureBalanceRow(tx, currency);
      const nextAvailable = roundMoney(Number(balance.available) - profit);

      await tx
        .update(companyBalances)
        .set({
          available: nextAvailable.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(companyBalances.currency, currency));

      await tx
        .update(companyRevenueEntries)
        .set({
          status: "reversed",
          reversedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(companyRevenueEntries.id, entry.id));

      return { ok: true as const, already: false as const };
    });
  } catch (error) {
    console.error("[company-revenue-reverse]", error);
    return { ok: false as const, already: false as const };
  }
}

export async function listCompanyBalances() {
  const rows = await db.query.companyBalances.findMany();
  const byCurrency = new Map(rows.map((r) => [r.currency, r]));
  for (const currency of ["NGN", "USD"] as const) {
    if (!byCurrency.has(currency)) {
      await ensureBalanceRow(db, currency);
    }
  }
  return db.query.companyBalances.findMany();
}

export async function getCompanyRevenueSummary() {
  const [balances, bySource, recent, payouts] = await Promise.all([
    listCompanyBalances(),
    db
      .select({
        source: companyRevenueEntries.source,
        currency: companyRevenueEntries.currency,
        profit: sql<string>`coalesce(sum(${companyRevenueEntries.profitAmount}), 0)`,
        profitNgn: sql<string>`coalesce(sum(${companyRevenueEntries.profitNgn}), 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(companyRevenueEntries)
      .where(eq(companyRevenueEntries.status, "recognized"))
      .groupBy(companyRevenueEntries.source, companyRevenueEntries.currency),
    db.query.companyRevenueEntries.findMany({
      orderBy: [desc(companyRevenueEntries.createdAt)],
      limit: 40,
    }),
    db.query.companyPayouts.findMany({
      orderBy: [desc(companyPayouts.createdAt)],
      limit: 20,
    }),
  ]);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30 = await db
    .select({
      profitNgn: sql<string>`coalesce(sum(${companyRevenueEntries.profitNgn}), 0)`,
      count: sql<number>`count(*)::int`,
    })
    .from(companyRevenueEntries)
    .where(
      and(
        eq(companyRevenueEntries.status, "recognized"),
        gte(companyRevenueEntries.createdAt, since),
      ),
    );

  return {
    balances: balances.map((row) => ({
      currency: row.currency,
      available: Number(row.available),
      reserved: Number(row.reserved),
      lifetimeRecognized: Number(row.lifetimeRecognized),
      lifetimeWithdrawn: Number(row.lifetimeWithdrawn),
    })),
    last30d: {
      profitNgn: Number(last30[0]?.profitNgn || 0),
      count: Number(last30[0]?.count || 0),
    },
    bySource: bySource.map((row) => ({
      source: row.source,
      currency: row.currency,
      profit: Number(row.profit),
      profitNgn: Number(row.profitNgn),
      count: Number(row.count),
    })),
    recent: recent.map((row) => ({
      id: row.id,
      source: row.source,
      status: row.status,
      currency: row.currency,
      grossIn: Number(row.grossIn),
      grossOut: Number(row.grossOut),
      markupAmount: Number(row.markupAmount),
      chargeAmount: Number(row.chargeAmount),
      fxSpreadAmount: Number(row.fxSpreadAmount),
      profitAmount: Number(row.profitAmount),
      profitNgn: Number(row.profitNgn),
      description: row.description,
      transactionId: row.transactionId,
      createdAt: row.createdAt.toISOString(),
    })),
    payouts: payouts.map((row) => ({
      id: row.id,
      currency: row.currency,
      amount: Number(row.amount),
      status: row.status,
      destinationLabel: row.destinationLabel,
      bankName: row.bankName,
      accountName: row.accountName,
      accountNumber: row.accountNumber,
      providerRef: row.providerRef,
      notes: row.notes,
      processedAt: row.processedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function requestCompanyPayout(input: {
  adminId: string;
  currency: string;
  amount: number;
  destinationLabel?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  bankCode?: string;
  notes?: string;
  sendViaGateway?: boolean;
}) {
  const currency = input.currency.toUpperCase();
  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid payout amount");
  }

  const prepared = await db.transaction(async (tx) => {
    const balance = await ensureBalanceRow(tx, currency);
    if (Number(balance.available) + 1e-9 < amount) {
      throw new Error(
        `Insufficient company ${currency} balance. Available ${Number(balance.available).toFixed(2)}.`,
      );
    }

    const nextAvailable = roundMoney(Number(balance.available) - amount);
    const nextWithdrawn = roundMoney(Number(balance.lifetimeWithdrawn) + amount);

    await tx
      .update(companyBalances)
      .set({
        available: nextAvailable.toFixed(2),
        lifetimeWithdrawn: nextWithdrawn.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(companyBalances.currency, currency));

    const [payout] = await tx
      .insert(companyPayouts)
      .values({
        currency,
        amount: amount.toFixed(2),
        status: input.sendViaGateway ? "pending" : "completed",
        destinationLabel: input.destinationLabel?.slice(0, 160) || "Business account",
        bankName: input.bankName?.slice(0, 120) || null,
        accountName: input.accountName?.slice(0, 160) || null,
        accountNumber: input.accountNumber?.slice(0, 32) || null,
        bankCode: input.bankCode?.slice(0, 20) || null,
        adminId: input.adminId,
        notes: input.notes || null,
        processedAt: input.sendViaGateway ? null : new Date(),
        metadata: { sendViaGateway: Boolean(input.sendViaGateway) },
      })
      .returning();

    return payout;
  });

  if (!input.sendViaGateway) return prepared;

  try {
    if (
      !input.bankCode ||
      !input.accountNumber ||
      !input.accountName
    ) {
      throw new Error(
        "Bank code, account number, and account name are required to send via Flutterwave",
      );
    }
    const { initiateFlutterwaveTransfer } = await import(
      "@/lib/flutterwave/transfers"
    );
    const reference = `CMP_${Date.now().toString(36).toUpperCase()}`;
    const transfer = await initiateFlutterwaveTransfer({
      accountBank: input.bankCode,
      accountNumber: input.accountNumber,
      beneficiaryName: input.accountName,
      amount,
      currency,
      reference,
      reason: "ORYNO company profit payout",
    });

    const [updated] = await db
      .update(companyPayouts)
      .set({
        status: transfer.status === "success" ? "completed" : "pending",
        providerRef: reference,
        processedAt: transfer.status === "success" ? new Date() : null,
        updatedAt: new Date(),
        metadata: {
          sendViaGateway: true,
          transferStatus: transfer.status,
          transferCode: transfer.transferCode ?? null,
        },
      })
      .where(eq(companyPayouts.id, prepared.id))
      .returning();

    return updated ?? prepared;
  } catch (error) {
    await db
      .update(companyPayouts)
      .set({
        status: "failed",
        notes:
          `${prepared.notes ? `${prepared.notes} · ` : ""}${error instanceof Error ? error.message : "Payout failed"}`.slice(
            0,
            2000,
          ),
        updatedAt: new Date(),
      })
      .where(eq(companyPayouts.id, prepared.id));

    await db.transaction(async (tx) => {
      const balance = await ensureBalanceRow(tx, currency);
      await tx
        .update(companyBalances)
        .set({
          available: roundMoney(Number(balance.available) + amount).toFixed(2),
          lifetimeWithdrawn: roundMoney(
            Math.max(0, Number(balance.lifetimeWithdrawn) - amount),
          ).toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(companyBalances.currency, currency));
    });

    throw error instanceof Error ? error : new Error("Company payout failed");
  }
}
