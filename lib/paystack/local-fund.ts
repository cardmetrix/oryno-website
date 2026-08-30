import { resolveCountryCode, currencyForCountry } from "@/lib/country";
import { creditWalletFromDeposit } from "@/lib/paystack/deposit-accounts";
import {
  hasPaystackKeys,
  isPaystackDemoMode,
  paystackFetch,
} from "@/lib/paystack/client";

type InitPaystackData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

function parseAmount(raw: string | number) {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Enter a valid amount greater than zero.");
  }
  return Math.round(value * 100) / 100;
}

export async function initiateLocalWalletFund(input: {
  userId: string;
  email: string;
  countryCode?: string | null;
  localAmount: string | number;
  callbackUrl: string;
}) {
  const countryCode = resolveCountryCode(input.countryCode);
  const currency = currencyForCountry(countryCode);
  const amount = parseAmount(input.localAmount);
  const reference = `FND_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  if (hasPaystackKeys()) {
    try {
      const channels =
        countryCode === "GH" || countryCode === "KE"
          ? ["card", "bank", "mobile_money"]
          : ["card", "bank"];

      const res = await paystackFetch<InitPaystackData>(
        "/transaction/initialize",
        {
          method: "POST",
          body: JSON.stringify({
            email: input.email,
            amount: Math.round(amount * 100),
            currency,
            reference,
            callback_url: input.callbackUrl,
            channels,
            metadata: {
              oryno_user_id: input.userId,
              purpose: "local_fund",
              country_code: countryCode,
              local_amount: amount,
              local_currency: currency,
            },
          }),
        },
      );

      return {
        mode: "paystack" as const,
        reference,
        authorizationUrl: res.data.authorization_url,
        accessCode: res.data.access_code,
        amount,
        currency,
        countryCode,
        demoMode: isPaystackDemoMode(),
      };
    } catch (error) {
      throw error;
    }
  }

  throw new Error(
    "Paystack is not configured for live wallet funding. Set PAYSTACK_SECRET_KEY.",
  );
}

export async function verifyLocalWalletFund(input: {
  userId: string;
  reference: string;
}) {
  if (!hasPaystackKeys()) {
    throw new Error("Paystack is not configured");
  }

  const res = await paystackFetch<{
    status: string;
    amount: number;
    currency: string;
    reference: string;
    paid_at?: string;
    channel?: string;
    metadata?: Record<string, unknown> | null;
  }>(`/transaction/verify/${encodeURIComponent(input.reference)}`);

  if ((res.data.status || "").toLowerCase() !== "success") {
    throw new Error("Payment is not completed yet");
  }

  const purpose = res.data.metadata?.purpose;
  if (purpose && purpose !== "local_fund") {
    throw new Error("This payment is not a wallet fund");
  }

  return creditWalletFromDeposit({
    userId: input.userId,
    amountKobo: res.data.amount,
    currency: res.data.currency,
    reference: res.data.reference || input.reference,
    channel: res.data.channel,
    paidAt: res.data.paid_at,
    raw: res.data as unknown as Record<string, unknown>,
  });
}
