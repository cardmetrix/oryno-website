/**
 * VTU Africa betting rail (used for non-Nigeria markets).
 * Docs: https://vtuafrica.com.ng/api/betting.php
 */

export function vtuAfricaApiKey() {
  return (process.env.VTU_AFRICA_API_KEY || process.env.BETTING_API_KEY || "").trim();
}

export function vtuAfricaBaseUrl() {
  return (
    process.env.VTU_AFRICA_BASE_URL ||
    "https://vtuafrica.com.ng/portal/api"
  ).replace(/\/$/, "");
}

export function hasVtuAfricaKeys() {
  return Boolean(vtuAfricaApiKey());
}

type LiveVerifyJson = {
  code?: number | string;
  description?: {
    Status?: string;
    Customer?: string;
    Service?: string;
    UserID?: string;
    message?: string;
  };
  message?: string;
};

type LiveFundJson = {
  code?: number | string;
  description?: {
    Status?: string;
    Service?: string;
    Network?: string;
    UserID?: string;
    Request_Amount?: string;
    Charge?: string;
    Amount_Charged?: string;
    ReferenceID?: string;
    message?: string;
  };
  message?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: T;
  try {
    json = JSON.parse(text) as T;
  } catch {
    const err = new Error(
      "VTU Africa returned an invalid response",
    ) as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(
      (json as { message?: string })?.message || "VTU Africa request failed",
    ) as Error & { status?: number };
    err.status = res.status >= 400 ? res.status : 503;
    throw err;
  }
  return json;
}

export async function vtuAfricaVerify(input: {
  serviceID: string;
  customerId: string;
}): Promise<{ ok: boolean; customerName: string | null; message?: string }> {
  const url = `${vtuAfricaBaseUrl()}/merchant-verify/?apikey=${encodeURIComponent(
    vtuAfricaApiKey(),
  )}&serviceName=Betting&service=${encodeURIComponent(input.serviceID)}&userid=${encodeURIComponent(input.customerId)}`;

  const json = await getJson<LiveVerifyJson>(url);
  const desc = json.description;
  const name = desc?.Customer?.trim() || null;
  const success =
    Number(json.code) === 101 ||
    String(desc?.Status || "").toLowerCase() === "completed" ||
    /verified/i.test(desc?.message || json.message || "");

  if (!success || !name) {
    return {
      ok: false,
      customerName: null,
      message: desc?.message || json.message || "Could not verify betting account",
    };
  }

  return { ok: true, customerName: name };
}

export async function vtuAfricaFund(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  phone?: string | null;
}): Promise<{ ok: boolean; reference: string; message?: string }> {
  const params = new URLSearchParams({
    apikey: vtuAfricaApiKey(),
    service: input.serviceID,
    userid: input.customerId,
    amount: String(Math.round(input.amount)),
    ref: input.reference,
  });
  if (input.phone) params.set("phone", input.phone.replace(/\D/g, "").slice(-11));

  const url = `${vtuAfricaBaseUrl()}/betpay/?${params.toString()}`;
  const json = await getJson<LiveFundJson>(url);
  const desc = json.description;
  const success =
    Number(json.code) === 101 ||
    String(desc?.Status || "").toLowerCase() === "completed";

  if (!success) {
    return {
      ok: false,
      reference: input.reference,
      message: desc?.message || json.message || "Betting funding failed",
    };
  }

  return {
    ok: true,
    reference: desc?.ReferenceID || input.reference,
    message: desc?.message || "Betting wallet funded",
  };
}
