import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import {
  creditWalletFromDeposit,
  findUserIdForDepositCharge,
} from "@/lib/flutterwave/deposit-accounts";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isPaymentSuccessful,
} from "@/lib/flutterwave/client";
import {
  chargePayloadForLookup,
  parseFlutterwaveWebhook,
} from "@/lib/flutterwave/webhook-payload";

type FlutterwaveTransaction = {
  id?: number | string;
  tx_ref?: string;
  flw_ref?: string;
  amount?: number;
  charged_amount?: number;
  currency?: string;
  status?: string;
  payment_type?: string;
  created_at?: string;
  customer?: { email?: string };
  meta?: unknown;
  metadata?: unknown;
};

function transactionList(data: unknown): FlutterwaveTransaction[] {
  if (Array.isArray(data)) return data as FlutterwaveTransaction[];
  const record = data as { transactions?: FlutterwaveTransaction[] };
  if (Array.isArray(record.transactions)) return record.transactions;
  return [];
}

export async function reconcileUserDeposits(userId: string) {
  if (!hasFlutterwaveKeys()) {
    return {
      ok: false as const,
      error: "Flutterwave is not configured",
      credited: 0,
      checked: 0,
    };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { id: true, email: true },
  });
  if (!user?.email) {
    return {
      ok: false as const,
      error: "User not found",
      credited: 0,
      checked: 0,
    };
  }

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const res = await flutterwaveFetch<unknown>(
    `/transactions?from=${from}&to=${to}&page=1`,
  );

  const email = user.email.trim().toLowerCase();
  let credited = 0;
  let checked = 0;

  for (const tx of transactionList(res.data)) {
    if (!isPaymentSuccessful(tx.status)) continue;

    const txEmail = tx.customer?.email?.trim().toLowerCase();
    if (txEmail && txEmail !== email) continue;

    const reference =
      tx.tx_ref?.trim() ||
      tx.flw_ref?.trim() ||
      (tx.id != null ? `FLW_${tx.id}` : null);
    const amountMajor = Number(tx.charged_amount ?? tx.amount);
    if (!reference || !Number.isFinite(amountMajor) || amountMajor <= 0) {
      continue;
    }

    checked += 1;

    const meta =
      parseFlutterwaveWebhook({
        event: "charge.completed",
        data: tx as Record<string, unknown>,
      }).meta ?? null;

    const matchedUserId = await findUserIdForDepositCharge(
      chargePayloadForLookup(tx as Record<string, unknown>, meta),
    );
    if (matchedUserId !== userId) continue;

    const result = await creditWalletFromDeposit({
      userId,
      amountKobo: Math.round(amountMajor * 100),
      currency: tx.currency,
      reference,
      channel: tx.payment_type,
      paidAt: tx.created_at,
      raw: {
        ...(tx as Record<string, unknown>),
        reconciled: true,
      },
    });

    if (!result.duplicated) credited += 1;
  }

  return {
    ok: true as const,
    credited,
    checked,
  };
}
