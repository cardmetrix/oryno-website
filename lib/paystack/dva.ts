import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userDepositAccounts, users } from "@/lib/db/schema";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
  paystackFetch,
} from "@/lib/paystack/client";

function paystackPreferredBank() {
  if (isPaystackDemoMode()) {
    return "test-bank";
  }
  return process.env.PAYSTACK_DVA_BANK?.trim() || "wema-bank";
}

type PaystackCustomer = {
  id: number;
  customer_code: string;
  email: string;
};

type PaystackDedicatedAccount = {
  id: number;
  account_number: string;
  account_name: string;
  currency: string;
  bank: { name: string; slug: string; id?: number };
  customer?: { customer_code?: string; id?: number };
};

async function ensurePaystackCustomer(user: typeof users.$inferSelect) {
  const existing = await db.query.userDepositAccounts.findFirst({
    where: eq(userDepositAccounts.userId, user.id),
  });
  if (existing?.paystackCustomerCode?.startsWith("CUS_")) {
    return existing.paystackCustomerCode;
  }

  const created = await paystackFetch<PaystackCustomer>("/customer", {
    method: "POST",
    body: JSON.stringify({
      email: user.email,
      first_name: user.fullName.split(" ")[0] || "ORYNO",
      last_name: user.fullName.split(" ").slice(1).join(" ") || "User",
      phone: user.phone || undefined,
      metadata: { oryno_user_id: user.id },
    }),
  });

  return created.data.customer_code;
}

export async function createPaystackDepositAccount(
  user: typeof users.$inferSelect,
) {
  if (!hasPaystackKeys()) {
    throw new Error(
      "Paystack is not configured for dedicated deposit accounts. Set PAYSTACK_SECRET_KEY.",
    );
  }

  const customerCode = await ensurePaystackCustomer(user);
  const preferredBank = paystackPreferredBank();

  try {
    const created = await paystackFetch<PaystackDedicatedAccount>(
      "/dedicated_account",
      {
        method: "POST",
        body: JSON.stringify({
          customer: customerCode,
          preferred_bank: preferredBank,
          first_name: user.fullName.split(" ")[0] || "ORYNO",
          last_name: user.fullName.split(" ").slice(1).join(" ") || "User",
          phone: user.phone || undefined,
        }),
      },
    );

    const data = created.data;
    const [row] = await db
      .insert(userDepositAccounts)
      .values({
        userId: user.id,
        provider: "paystack",
        currency: (data.currency || "NGN").toUpperCase(),
        accountNumber: data.account_number,
        accountName: data.account_name,
        bankName: data.bank?.name || "Paystack",
        bankSlug: data.bank?.slug || preferredBank,
        paystackCustomerCode: customerCode,
        paystackAccountId: String(data.id),
        status: "active",
        metadata: { mode: isPaystackDemoMode() ? "test" : "live", raw: data },
      })
      .onConflictDoNothing()
      .returning();

    if (row) return row;

    const existing = await db.query.userDepositAccounts.findFirst({
      where: eq(userDepositAccounts.userId, user.id),
    });
    if (!existing) throw new Error("Unable to save Paystack deposit account");
    return existing;
  } catch (error) {
    console.error("[paystack-dva-create]", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to create Paystack deposit account");
  }
}
