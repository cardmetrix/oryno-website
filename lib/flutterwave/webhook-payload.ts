import {
  isPaymentSuccessful,
  normalizeFlutterwaveMeta,
} from "@/lib/flutterwave/client";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function stringField(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export type ParsedFlutterwaveWebhook = {
  eventName: string;
  data: JsonRecord;
  meta: Record<string, unknown> | null;
  reference: string | null;
  amountMajor: number;
  status: string | null;
  isChargeSuccess: boolean;
};

export function parseFlutterwaveWebhook(body: JsonRecord): ParsedFlutterwaveWebhook {
  const eventName = String(
    body.event || body.type || body["event.type"] || "",
  )
    .trim()
    .toLowerCase();

  const data = asRecord(body.data) ?? body;
  const meta =
    normalizeFlutterwaveMeta(data.meta) ??
    normalizeFlutterwaveMeta(data.metadata) ??
    normalizeFlutterwaveMeta(body.meta_data) ??
    normalizeFlutterwaveMeta(body.meta);

  const reference =
    stringField(data.tx_ref) ||
    stringField(data.reference) ||
    stringField(data.flw_ref) ||
    (data.id != null ? `FLW_${String(data.id)}` : null);

  const amountMajor = Number(data.charged_amount ?? data.amount ?? 0);
  const status = stringField(data.status);

  const isChargeSuccess =
    eventName === "charge.completed" ||
    eventName === "charge.success" ||
    (eventName.includes("bank_transfer") && isPaymentSuccessful(status));

  return {
    eventName,
    data,
    meta,
    reference,
    amountMajor,
    status,
    isChargeSuccess,
  };
}

export function chargePayloadForLookup(
  data: JsonRecord,
  meta: Record<string, unknown> | null,
) {
  const customer = asRecord(data.customer);
  const authorization = asRecord(data.authorization);

  return {
    customer: customer
      ? {
          customer_code: stringField(customer.customer_code) ?? undefined,
          email: stringField(customer.email) ?? undefined,
        }
      : undefined,
    authorization: authorization
      ? {
          receiver_bank_account_number:
            stringField(authorization.receiver_bank_account_number) ??
            undefined,
        }
      : undefined,
    account_number:
      stringField(data.account_number) ||
      stringField(meta?.account_number) ||
      stringField(meta?.accountnumber) ||
      undefined,
    account_id: data.account_id != null ? String(data.account_id) : undefined,
    tx_ref: stringField(data.tx_ref) ?? undefined,
    flw_ref: stringField(data.flw_ref) ?? undefined,
    order_ref: stringField(data.order_ref) ?? undefined,
    meta,
    metadata: meta,
  };
}
