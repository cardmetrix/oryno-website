import {
  findHubtelBillService,
  resolveHubtelServiceId,
} from "./catalog";
import { hubtelErrorToEnglish } from "./errors";
import type { HubtelPayResult, HubtelVerifyResult } from "./types";

const LOG = "[hubtel]";

export function hubtelClientId() {
  return (process.env.HUBTEL_CLIENT_ID || "").trim();
}

export function hubtelClientSecret() {
  return (process.env.HUBTEL_CLIENT_SECRET || "").trim();
}

export function hubtelPosAccountId() {
  return (
    process.env.HUBTEL_POS_ACCOUNT_ID ||
    process.env.HUBTEL_ACCOUNT_ID ||
    ""
  ).trim();
}

export function hubtelBaseUrl() {
  return (
    process.env.HUBTEL_BASE_URL || "https://cs.hubtel.com/commissionservices"
  ).replace(/\/$/, "");
}

export function isHubtelDemoForced() {
  const flag = (process.env.HUBTEL_DEMO || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function hasHubtelKeys() {
  return Boolean(
    hubtelClientId() && hubtelClientSecret() && hubtelPosAccountId(),
  );
}

export function isHubtelDemoMode() {
  return isHubtelDemoForced() || !hasHubtelKeys();
}

function basicAuth() {
  return Buffer.from(`${hubtelClientId()}:${hubtelClientSecret()}`).toString(
    "base64",
  );
}

function serviceUrl(serviceId: string, destination?: string) {
  const account = encodeURIComponent(hubtelPosAccountId());
  const id = encodeURIComponent(serviceId);
  const base = `${hubtelBaseUrl()}/${account}/${id}`;
  if (!destination) return base;
  return `${base}?destination=${encodeURIComponent(destination)}`;
}

type HubtelJson = {
  ResponseCode?: string | number;
  responseCode?: string | number;
  Message?: string;
  message?: string;
  Data?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNumber(...values: unknown[]) {
  for (const value of values) {
    const n = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function hubtelFetch(url: string, init?: RequestInit): Promise<HubtelJson> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${basicAuth()}`,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: HubtelJson = {};
  try {
    json = text ? (JSON.parse(text) as HubtelJson) : {};
  } catch {
    const err = new Error("Hubtel returned an invalid response") as Error & {
      status?: number;
    };
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(
      hubtelErrorToEnglish(json.Message || json.message || `Hubtel HTTP ${res.status}`),
    ) as Error & { status?: number };
    err.status = res.status >= 400 ? res.status : 503;
    throw err;
  }
  return json;
}

function isSuccessCode(code: unknown) {
  const raw = String(code ?? "").trim();
  return raw === "0000" || raw === "0001" || raw === "200" || raw === "0";
}

function isPendingCode(code: unknown) {
  return String(code ?? "").trim() === "0001";
}

export async function verifyHubtelCustomer(input: {
  serviceID: string;
  customerRef: string;
  variationCode?: string | null;
}): Promise<HubtelVerifyResult> {
  const service = findHubtelBillService(input.serviceID);
  if (!service) {
    return { ok: false, demo: isHubtelDemoMode(), customerName: null, message: "Unknown Ghana bill provider" };
  }
  const customerRef = input.customerRef.trim();
  if (customerRef.length < 6) {
    return {
      ok: false,
      demo: isHubtelDemoMode(),
      customerName: null,
      message: `Enter a valid ${service.customerLabel.toLowerCase()}`,
    };
  }

  if (isHubtelDemoMode()) {
    if (customerRef === "00000000") {
      return {
        ok: false,
        demo: true,
        customerName: null,
        message: "Invalid account number",
      };
    }
    return {
      ok: true,
      demo: true,
      customerName: "ORYNO Ghana Demo",
      customerAddress: "Accra, Ghana",
      renewalAmount: service.category === "tv" ? 89 : null,
      currentBouquet: service.category === "tv" ? `${service.name} Compact` : null,
    };
  }

  const hubtelId = resolveHubtelServiceId(input.serviceID, input.variationCode);
  if (!hubtelId) {
    return {
      ok: false,
      demo: false,
      customerName: null,
      message: `Set the Hubtel service ID for ${service.name} in .env (HUBTEL_SERVICE_*).`,
    };
  }

  const json = await hubtelFetch(serviceUrl(hubtelId, customerRef));
  const data = asRecord(json.Data) || asRecord(json.data) || {};
  const name = pickString(
    data.Name,
    data.name,
    data.CustomerName,
    data.customerName,
    data.AccountName,
    data.Customer,
  );
  const code = json.ResponseCode ?? json.responseCode;
  if (!isSuccessCode(code) || !name) {
    return {
      ok: false,
      demo: false,
      customerName: null,
      message: hubtelErrorToEnglish(
        json.Message || json.message || "Could not verify that account",
      ),
    };
  }

  return {
    ok: true,
    demo: false,
    customerName: name,
    customerAddress: pickString(data.Address, data.Location, data.CustomerAddress),
    renewalAmount: pickNumber(
      data.AmountDue,
      data.RenewalAmount,
      data.Amount,
      data.Balance,
    ),
    currentBouquet: pickString(data.Bouquet, data.Package, data.CurrentBouquet),
  };
}

export async function payHubtelBill(input: {
  serviceID: string;
  variationCode?: string | null;
  customerRef: string;
  amount: number;
  reference: string;
  callbackUrl?: string | null;
}): Promise<HubtelPayResult> {
  const service = findHubtelBillService(input.serviceID);
  if (!service) {
    return {
      ok: false,
      demo: isHubtelDemoMode(),
      pending: false,
      reference: input.reference,
      transactionId: null,
      token: null,
      message: "Unknown Ghana bill provider",
    };
  }

  if (isHubtelDemoMode()) {
    if (input.customerRef.trim() === "99999999") {
      return {
        ok: false,
        demo: true,
        pending: false,
        reference: input.reference,
        transactionId: null,
        token: null,
        message: "Demo provider declined this payment",
      };
    }
    return {
      ok: true,
      demo: true,
      pending: false,
      reference: `DEMO-GH-${input.reference.slice(-10)}`,
      transactionId: input.reference,
      token:
        service.category === "electricity" && input.variationCode === "prepaid"
          ? "1234-5678-9012-3456"
          : null,
      message: "Demo Ghana bill paid",
    };
  }

  const hubtelId = resolveHubtelServiceId(input.serviceID, input.variationCode);
  if (!hubtelId) {
    return {
      ok: false,
      demo: false,
      pending: false,
      reference: input.reference,
      transactionId: null,
      token: null,
      message: `Set the Hubtel service ID for ${service.name} in .env (HUBTEL_SERVICE_*).`,
    };
  }

  const callback =
    input.callbackUrl ||
    (process.env.HUBTEL_CALLBACK_URL || "").trim() ||
    (process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/hubtel`
      : "");

  const json = await hubtelFetch(serviceUrl(hubtelId), {
    method: "POST",
    body: JSON.stringify({
      Destination: input.customerRef.trim(),
      Amount: input.amount,
      CallbackUrl: callback || undefined,
      ClientReference: input.reference,
    }),
  });

  const data = asRecord(json.Data) || asRecord(json.data) || {};
  const code = json.ResponseCode ?? json.responseCode;
  const ok = isSuccessCode(code);
  const token = pickString(
    data.Token,
    data.token,
    data.PrepaidToken,
    data.MeterToken,
    asRecord(data.Meta)?.Token,
    asRecord(data.Meta)?.token,
  );

  if (!ok) {
    return {
      ok: false,
      demo: false,
      pending: false,
      reference: input.reference,
      transactionId: pickString(data.TransactionId, data.transactionId),
      token: null,
      message: hubtelErrorToEnglish(
        json.Message || json.message || "Ghana bill payment failed",
      ),
      raw: { ...json, Data: data },
    };
  }

  console.log(LOG, "pay ok", {
    service: input.serviceID,
    pending: isPendingCode(code),
    ref: input.reference,
  });

  return {
    ok: true,
    demo: false,
    pending: isPendingCode(code),
    reference: pickString(data.ClientReference, data.clientReference) || input.reference,
    transactionId: pickString(data.TransactionId, data.transactionId),
    token,
    message: json.Message || json.message,
    raw: { ...json, Data: data },
  };
}
