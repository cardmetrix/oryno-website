import { creditWalletFromDeposit } from "@/lib/flutterwave/deposit-accounts";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
  isPaymentSuccessful,
  normalizeFlutterwaveMeta,
} from "@/lib/flutterwave/client";
import {
  flutterwavePaymentOptions,
} from "@/lib/payments/country";
import { resolveCountryCode, currencyForCountry } from "@/lib/country";

type InitPaymentData = {
  link?: string;
  authorization_url?: string;
};

function parseAmount(raw: string | number) {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return Math.round(value * 100) / 100;
}

function asMeta(raw: unknown): Record<string, unknown> | null {
  return normalizeFlutterwaveMeta(raw);
}

export async function initiateLocalWalletFund(input: {
  userId: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  countryCode?: string | null;
  localAmount: string | number;
  callbackUrl: string;
}) {
  const countryCode = resolveCountryCode(input.countryCode);
  const currency = currencyForCountry(countryCode);
  const amount = parseAmount(input.localAmount);
  const reference = `FND_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  if (!hasFlutterwaveKeys()) {
    throw new Error(
      "Flutterwave is not configured for live wallet funding. Set FLUTTERWAVE_SECRET_KEY.",
    );
  }

  const res = await flutterwaveFetch<InitPaymentData>("/payments", {
    method: "POST",
    body: JSON.stringify({
      tx_ref: reference,
      amount,
      currency,
      redirect_url: input.callbackUrl,
      payment_options: flutterwavePaymentOptions(countryCode),
      customer: {
        email: input.email,
        name: input.name || "ORYNO User",
        phonenumber: input.phone || undefined,
      },
      customizations: {
        title: "ORYNO",
        description: "Wallet funding",
      },
      meta: {
        oryno_user_id: input.userId,
        purpose: "local_fund",
        country_code: countryCode,
        local_amount: amount,
        local_currency: currency,
      },
    }),
  });

  const authorizationUrl = res.data.link || res.data.authorization_url;
  if (!authorizationUrl) {
    throw new Error("Flutterwave did not return a checkout link");
  }

  return {
    mode: "flutterwave" as const,
    reference,
    authorizationUrl,
    amount,
    currency,
    countryCode,
    demoMode: isFlutterwaveDemoMode(),
  };
}

export async function verifyLocalWalletFund(input: {
  userId: string;
  reference: string;
  transactionId?: string | number | null;
}) {
  if (!hasFlutterwaveKeys()) {
    throw new Error("Flutterwave is not configured");
  }

  type VerifyData = {
    status: string;
    amount: number;
    charged_amount?: number;
    currency: string;
    tx_ref?: string;
    flw_ref?: string;
    payment_type?: string;
    created_at?: string;
    meta?: unknown;
    customer?: { email?: string };
  };

  const res = input.transactionId
    ? await flutterwaveFetch<VerifyData>(
        `/transactions/${encodeURIComponent(String(input.transactionId))}/verify`,
      )
    : await flutterwaveFetch<VerifyData>(
        `/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.reference)}`,
      );

  if (!isPaymentSuccessful(res.data.status)) {
    throw new Error("Payment is not completed yet");
  }

  const meta = asMeta(res.data.meta);
  const purpose = meta?.purpose;
  if (purpose && purpose !== "local_fund") {
    throw new Error("This payment is not a wallet fund");
  }

  const amountMajor = Number(res.data.charged_amount ?? res.data.amount);
  const reference = res.data.tx_ref || input.reference;

  return creditWalletFromDeposit({
    userId: input.userId,
    amountKobo: Math.round(amountMajor * 100),
    currency: res.data.currency,
    reference,
    channel: res.data.payment_type,
    paidAt: res.data.created_at,
    raw: res.data as unknown as Record<string, unknown>,
  });
}
