import {
  DEMO_BETTING_CUSTOMERS,
  findBettingProvider,
  normalizeBettingCustomerId,
} from "./catalog";

export function bettingApiKey() {
  return (process.env.VTU_AFRICA_API_KEY || process.env.BETTING_API_KEY || "").trim();
}

export function bettingBaseUrl() {
  return (
    process.env.VTU_AFRICA_BASE_URL ||
    "https://vtuafrica.com.ng/portal/api"
  ).replace(/\/$/, "");
}

export function isBettingDemoForced() {
  const flag = (process.env.BETTING_DEMO || "").trim().toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function hasBettingKeys() {
  return Boolean(bettingApiKey());
}

/** Demo when keys are missing or BETTING_DEMO is set. */
export function isBettingDemoMode() {
  return isBettingDemoForced() || !hasBettingKeys();
}

function demoCustomer(customerId: string) {
  return DEMO_BETTING_CUSTOMERS.find((c) => c.customerId === customerId);
}

export function demoVerifyName(customerId: string): {
  ok: boolean;
  name: string | null;
  message?: string;
} {
  const known = demoCustomer(customerId);
  if (known) {
    if (known.outcome === "verify_fail") {
      return { ok: false, name: null, message: "Invalid betting account ID" };
    }
    return { ok: true, name: known.name };
  }
  if (!/^\d{6,20}$/.test(customerId)) {
    return { ok: false, name: null, message: "Enter a valid betting account ID" };
  }
  return { ok: true, name: "ORYNO Demo Customer" };
}

export function shouldDemoFundFail(customerId: string) {
  return demoCustomer(customerId)?.outcome === "fund_fail";
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
    const err = new Error("Betting provider returned an invalid response") as Error & {
      status?: number;
    };
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(
      (json as { message?: string })?.message || "Betting provider request failed",
    ) as Error & { status?: number };
    err.status = res.status >= 400 ? res.status : 503;
    throw err;
  }
  return json;
}

export async function verifyBettingCustomer(input: {
  serviceID: string;
  customerId: string;
}): Promise<{
  ok: boolean;
  demo: boolean;
  customerName: string | null;
  message?: string;
}> {
  const provider = findBettingProvider(input.serviceID);
  if (!provider) {
    return { ok: false, demo: isBettingDemoMode(), customerName: null, message: "Unknown betting provider" };
  }
  const customerId = normalizeBettingCustomerId(input.customerId);

  if (isBettingDemoMode()) {
    const demo = demoVerifyName(customerId);
    return {
      ok: demo.ok,
      demo: true,
      customerName: demo.name,
      message: demo.message,
    };
  }

  const url = `${bettingBaseUrl()}/merchant-verify/?apikey=${encodeURIComponent(
    bettingApiKey(),
  )}&serviceName=Betting&service=${encodeURIComponent(provider.serviceID)}&userid=${encodeURIComponent(customerId)}`;

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
      demo: false,
      customerName: null,
      message: desc?.message || json.message || "Could not verify betting account",
    };
  }

  return { ok: true, demo: false, customerName: name };
}

export async function fundBettingAccount(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  phone?: string | null;
}): Promise<{
  ok: boolean;
  demo: boolean;
  reference: string;
  message?: string;
}> {
  const provider = findBettingProvider(input.serviceID);
  if (!provider) {
    return { ok: false, demo: isBettingDemoMode(), reference: input.reference, message: "Unknown betting provider" };
  }
  const customerId = normalizeBettingCustomerId(input.customerId);

  if (isBettingDemoMode()) {
    if (shouldDemoFundFail(customerId)) {
      return {
        ok: false,
        demo: true,
        reference: input.reference,
        message: "Demo provider declined this funding (99999999)",
      };
    }
    const verified = demoVerifyName(customerId);
    if (!verified.ok) {
      return {
        ok: false,
        demo: true,
        reference: input.reference,
        message: verified.message || "Invalid betting account ID",
      };
    }
    return {
      ok: true,
      demo: true,
      reference: `DEMO-BET-${input.reference.slice(-10)}`,
      message: "Demo betting wallet funded",
    };
  }

  const params = new URLSearchParams({
    apikey: bettingApiKey(),
    service: provider.serviceID,
    userid: customerId,
    amount: String(Math.round(input.amount)),
    ref: input.reference,
  });
  if (input.phone) params.set("phone", input.phone.replace(/\D/g, "").slice(-11));

  const url = `${bettingBaseUrl()}/betpay/?${params.toString()}`;
  const json = await getJson<LiveFundJson>(url);
  const desc = json.description;
  const success =
    Number(json.code) === 101 ||
    String(desc?.Status || "").toLowerCase() === "completed";

  if (!success) {
    return {
      ok: false,
      demo: false,
      reference: input.reference,
      message: desc?.message || json.message || "Betting funding failed",
    };
  }

  return {
    ok: true,
    demo: false,
    reference: desc?.ReferenceID || input.reference,
    message: desc?.message || "Betting wallet funded",
  };
}
