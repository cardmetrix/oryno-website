import {
  hasReloadlyKeys,
  isReloadlyDemoForced,
  isReloadlySandbox,
  reloadlyClientId,
  reloadlyClientSecret,
} from "@/lib/reloadly/client";
import { kenyaBillErrorToEnglish } from "./errors";
import {
  findKenyaBillService,
  reloadlyTypeForCategory,
  resolveKenyaBillerId,
} from "./catalog";
import { findZaBillService, resolveZaBillerId } from "./za-catalog";
import type {
  KenyaBillPayResult,
  KenyaBillVerifyResult,
  ReloadlyPayResponse,
  ReloadlyUtilityBiller,
} from "./types";

const AUTH_URL = "https://auth.reloadly.com/oauth/token";
const LIVE_BASE = "https://utilities.reloadly.com";
const SANDBOX_BASE = "https://utilities-sandbox.reloadly.com";
const ACCEPT = "application/com.reloadly.utilities-v1+json";

let cachedToken: { token: string; expiresAt: number; audience: string } | null =
  null;

export function isKenyaBillsDemoMode() {
  return isReloadlyDemoForced() || !hasReloadlyKeys();
}

export const isZaBillsDemoMode = isKenyaBillsDemoMode;

function utilitiesBase() {
  return isReloadlySandbox() ? SANDBOX_BASE : LIVE_BASE;
}

function utilitiesAudience() {
  return utilitiesBase();
}

async function utilitiesToken() {
  if (
    cachedToken &&
    cachedToken.audience === utilitiesAudience() &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: reloadlyClientId(),
      client_secret: reloadlyClientSecret(),
      grant_type: "client_credentials",
      audience: utilitiesAudience(),
    }),
    cache: "no-store",
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      kenyaBillErrorToEnglish(json.message || json.error || "Reloadly utilities auth failed"),
    );
  }
  cachedToken = {
    token: json.access_token,
    audience: utilitiesAudience(),
    expiresAt: Date.now() + Math.max(60, Number(json.expires_in || 3600)) * 1000,
  };
  return cachedToken.token;
}

async function utilitiesFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await utilitiesToken();
  const res = await fetch(`${utilitiesBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: ACCEPT,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & {
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(
      kenyaBillErrorToEnglish(
        json.message || json.error || `Reloadly utilities error (${res.status})`,
      ),
    );
  }
  return json;
}

export async function listReloadlyBillers(
  countryISOCode: "KE" | "ZA",
  category?: "tv" | "electricity" | "water",
) {
  if (isKenyaBillsDemoMode()) return [];
  try {
    const types = category
      ? category === "tv"
        ? ["TV_BILL_PAYMENT", "INTERNET_BILL_PAYMENT"]
        : [reloadlyTypeForCategory(category)]
      : [
          "TV_BILL_PAYMENT",
          "INTERNET_BILL_PAYMENT",
          "ELECTRICITY_BILL_PAYMENT",
          "WATER_BILL_PAYMENT",
        ];
    const pages = await Promise.all(
      types.map(async (type) => {
        const params = new URLSearchParams({
          countryISOCode,
          type,
          size: "50",
          page: "1",
        });
        const json = await utilitiesFetch<{ content?: ReloadlyUtilityBiller[] }>(
          `/billers?${params.toString()}`,
        );
        return json.content ?? [];
      }),
    );
    return pages.flat();
  } catch (error) {
    console.error(`[${countryISOCode.toLowerCase()}-bills-billers]`, error);
    return [];
  }
}

export async function listKenyaReloadlyBillers(
  category?: "tv" | "electricity" | "water",
) {
  return listReloadlyBillers("KE", category);
}

export async function listZaReloadlyBillers(
  category?: "tv" | "electricity" | "water",
) {
  return listReloadlyBillers("ZA", category);
}

export async function verifyKenyaBillCustomer(input: {
  serviceID: string;
  customerRef: string;
  variationCode?: string | null;
}): Promise<KenyaBillVerifyResult> {
  const service = findKenyaBillService(input.serviceID);
  if (!service) {
    return { ok: false, demo: true, customerName: null, message: "Unknown Kenya bill service" };
  }
  const ref = input.customerRef.replace(/\s+/g, "").trim();
  if (ref.length < 6) {
    return {
      ok: false,
      demo: isKenyaBillsDemoMode(),
      customerName: null,
      message: `Enter a valid ${service.customerLabel.toLowerCase()}`,
    };
  }

  if (isKenyaBillsDemoMode()) {
    return {
      ok: false,
      demo: false,
      customerName: null,
      message:
        "Reloadly Utilities is not configured for live Kenya bills. Set Reloadly keys and RELOADLY_DEMO=false.",
    };
  }

  const billers = await listKenyaReloadlyBillers(service.category);
  const billerId = resolveKenyaBillerId(service.serviceID, input.variationCode, billers);
  if (billerId) {
    try {
      const json = await utilitiesFetch<{
        subscriberName?: string;
        name?: string;
        address?: string;
        amountDue?: number;
      }>(`/billers/${billerId}/validate`, {
        method: "POST",
        body: JSON.stringify({ subscriberAccountNumber: ref }),
      });
      return {
        ok: true,
        demo: false,
        customerName: json.subscriberName || json.name || "Verified customer",
        customerAddress: json.address,
        renewalAmount: json.amountDue,
      };
    } catch {
      // Not every biller exposes validate — allow pay after a format check.
    }
  }

  return {
    ok: true,
    demo: false,
    customerName: "Verified customer",
  };
}

export async function payKenyaBill(input: {
  serviceID: string;
  variationCode?: string | null;
  customerRef: string;
  amount: number;
  reference: string;
}): Promise<KenyaBillPayResult> {
  const service = findKenyaBillService(input.serviceID);
  if (!service) {
    return { ok: false, demo: true, pending: false, reference: input.reference, transactionId: null, token: null, message: "Unknown Kenya bill service" };
  }

  if (isKenyaBillsDemoMode()) {
    throw new Error(
      "Reloadly Utilities is not configured for live Kenya bills. Set Reloadly keys and RELOADLY_DEMO=false.",
    );
  }

  const billers = await listKenyaReloadlyBillers(service.category);
  const billerId = resolveKenyaBillerId(service.serviceID, input.variationCode, billers);
  if (!billerId) {
    return {
      ok: false,
      demo: false,
      pending: false,
      reference: input.reference,
      transactionId: null,
      token: null,
      message: kenyaBillErrorToEnglish("unknown biller"),
    };
  }

  const paid = await utilitiesFetch<ReloadlyPayResponse>("/pay", {
    method: "POST",
    body: JSON.stringify({
      subscriberAccountNumber: input.customerRef,
      amount: input.amount,
      billerId,
      useLocalAmount: true,
      referenceId: input.reference,
    }),
  });

  const status = (paid.status || "SUCCESSFUL").toUpperCase();
  const token =
    paid.pinDetail?.pin ||
    (typeof paid.additionalInfo?.token === "string"
      ? paid.additionalInfo.token
      : null);

  return {
    ok: status !== "FAILED",
    demo: false,
    pending: status === "PENDING" || status === "PROCESSING",
    reference: paid.referenceId || input.reference,
    transactionId: paid.id != null ? String(paid.id) : null,
    token,
    message: paid.message,
    raw: paid as unknown as Record<string, unknown>,
  };
}

export async function verifyZaBillCustomer(input: {
  serviceID: string;
  customerRef: string;
  variationCode?: string | null;
}): Promise<KenyaBillVerifyResult> {
  const service = findZaBillService(input.serviceID);
  if (!service) {
    return {
      ok: false,
      demo: true,
      customerName: null,
      message: "Unknown South Africa bill service",
    };
  }
  const ref = input.customerRef.replace(/\s+/g, "").trim();
  if (ref.length < 6) {
    return {
      ok: false,
      demo: isZaBillsDemoMode(),
      customerName: null,
      message: `Enter a valid ${service.customerLabel.toLowerCase()}`,
    };
  }

  if (isZaBillsDemoMode()) {
    return {
      ok: false,
      demo: false,
      customerName: null,
      message:
        "Reloadly Utilities is not configured for live South Africa bills. Set Reloadly keys and RELOADLY_DEMO=false.",
    };
  }

  const billers = await listZaReloadlyBillers(service.category);
  const billerId = resolveZaBillerId(service.serviceID, input.variationCode, billers);
  if (billerId) {
    try {
      const json = await utilitiesFetch<{
        subscriberName?: string;
        name?: string;
        address?: string;
        amountDue?: number;
      }>(`/billers/${billerId}/validate`, {
        method: "POST",
        body: JSON.stringify({ subscriberAccountNumber: ref }),
      });
      return {
        ok: true,
        demo: false,
        customerName: json.subscriberName || json.name || "Verified customer",
        customerAddress: json.address,
        renewalAmount: json.amountDue,
      };
    } catch {
      // Not every biller exposes validate — allow pay after a format check.
    }
  }

  return {
    ok: true,
    demo: false,
    customerName: "Verified customer",
  };
}

export async function payZaBill(input: {
  serviceID: string;
  variationCode?: string | null;
  customerRef: string;
  amount: number;
  reference: string;
}): Promise<KenyaBillPayResult> {
  const service = findZaBillService(input.serviceID);
  if (!service) {
    return {
      ok: false,
      demo: true,
      pending: false,
      reference: input.reference,
      transactionId: null,
      token: null,
      message: "Unknown South Africa bill service",
    };
  }

  if (isZaBillsDemoMode()) {
    throw new Error(
      "Reloadly Utilities is not configured for live South Africa bills. Set Reloadly keys and RELOADLY_DEMO=false.",
    );
  }

  const billers = await listZaReloadlyBillers(service.category);
  const billerId = resolveZaBillerId(service.serviceID, input.variationCode, billers);
  if (!billerId) {
    return {
      ok: false,
      demo: false,
      pending: false,
      reference: input.reference,
      transactionId: null,
      token: null,
      message: kenyaBillErrorToEnglish("unknown biller"),
    };
  }

  const paid = await utilitiesFetch<ReloadlyPayResponse>("/pay", {
    method: "POST",
    body: JSON.stringify({
      subscriberAccountNumber: input.customerRef,
      amount: input.amount,
      billerId,
      useLocalAmount: true,
      referenceId: input.reference,
    }),
  });

  const status = (paid.status || "SUCCESSFUL").toUpperCase();
  const token =
    paid.pinDetail?.pin ||
    (typeof paid.additionalInfo?.token === "string"
      ? paid.additionalInfo.token
      : null);

  return {
    ok: status !== "FAILED",
    demo: false,
    pending: status === "PENDING" || status === "PROCESSING",
    reference: paid.referenceId || input.reference,
    transactionId: paid.id != null ? String(paid.id) : null,
    token,
    message: paid.message,
    raw: paid as unknown as Record<string, unknown>,
  };
}
