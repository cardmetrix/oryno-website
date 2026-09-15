/**
 * Pairgate betting rail (Nigeria).
 * Docs: https://pairgate.com/developers/betting-verify
 *       https://pairgate.com/developers/betting-purchase
 *       https://pairgate.com/developers/webhooks
 */

import {
  isPairgateDataSuccess,
  isPairgateHttpOk,
  isPairgateSandbox,
  pairgateApiPath,
  pairgateErrorMessage,
  pairgateFetch,
} from "@/lib/pairgate/http";

export {
  hasPairgateKeys,
  isPairgateSandbox,
  pairgateApiKey,
  pairgateBaseUrl,
  pairgateWebhookSecret,
  verifyPairgateWebhookSignature,
  type PairgateWebhookPayload,
} from "@/lib/pairgate/http";

export async function pairgateVerify(input: {
  serviceID: string;
  customerId: string;
}): Promise<{ ok: boolean; customerName: string | null; message?: string }> {
  const path = pairgateApiPath("/bet/verify", "/test/bet/verify");
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify({
      provider_id: input.serviceID.trim().toLowerCase(),
      customer_id: input.customerId,
    }),
  });

  const data = json.data || {};
  const valid = data.status === true || data.status === "true";
  const name = String(data.customer_name || "").trim();
  const httpOk = isPairgateHttpOk(ok, status, json);

  if (!httpOk) {
    return {
      ok: false,
      customerName: null,
      message: pairgateErrorMessage(json, "Could not verify betting account"),
    };
  }

  if (!valid || !name) {
    return {
      ok: false,
      customerName: null,
      message: pairgateErrorMessage(json, "Could not verify betting account"),
    };
  }

  return { ok: true, customerName: name };
}

export async function pairgateFund(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  recipientName?: string | null;
}): Promise<{ ok: boolean; reference: string; message?: string }> {
  const path = pairgateApiPath("/bet/purchase", "/test/bet/purchase");
  const body: Record<string, unknown> = {
    provider_id: input.serviceID.trim().toLowerCase(),
    amount: Math.round(input.amount),
    customer_id: input.customerId,
    reference: input.reference.slice(0, 100),
  };
  if (input.recipientName?.trim()) {
    body.recipient_name = input.recipientName.trim();
  }

  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data = json.data || {};
  const referenceCode = String(
    data.reference_code || input.reference,
  ).trim();

  if (isPairgateSandbox() && data.test_mode) {
    return {
      ok: true,
      reference: referenceCode || `TEST-${input.reference}`,
      message: String(data.message || "Test betting wallet funded"),
    };
  }

  const success =
    isPairgateHttpOk(ok, status, json) && isPairgateDataSuccess(data, json);

  if (!success) {
    return {
      ok: false,
      reference: input.reference,
      message: pairgateErrorMessage(json, "Betting funding failed"),
    };
  }

  return {
    ok: true,
    reference: referenceCode,
    message: String(data.message || "Betting wallet funded"),
  };
}

export async function pairgateTransactionStatus(referenceCode: string) {
  const path = `/transaction/status?reference_code=${encodeURIComponent(referenceCode)}`;
  const { ok, json } = await pairgateFetch(path, { method: "GET" });
  const data = json.data || json;
  return {
    ok,
    status: String((data as Record<string, unknown>).status || ""),
    data: data as Record<string, unknown>,
  };
}
