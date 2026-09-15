/**
 * ClubKonnect / Nellobyte betting rail (Nigeria).
 *
 * Official endpoints (HTTPS GET → JSON):
 * - Fund:   /APIBettingV1.asp?UserID=&APIKey=&BettingCompany=&CustomerID=&Amount=&RequestID=&CallBackURL=
 * - Verify: /APIVerifyBettingV1.asp?UserID=&APIKey=&BettingCompany=&CustomerID=
 * - Query:  /APIQueryV1.asp?UserID=&APIKey=&OrderID=  (or RequestID=)
 * - Types:  /APIBettingTypeV2.asp?UserID=
 *
 * Docs: https://www.clubkonnect.com/APIParaGetBettingV1.asp
 */

/** Map ORYNO catalog serviceIDs → ClubKonnect BettingCompany codes. */
const CLUBKONNECT_COMPANY_CODES: Record<string, string> = {
  bet9ja: "BET9JA",
  sportybet: "SPORTYBET",
  "1xbet": "1XBET",
  betking: "BETKING",
  melbet: "MELBET",
  betway: "BETWAY",
  nairabet: "NAIRABET",
  merrybet: "MERRYBET",
  naijabet: "NAIJABET",
  bangbet: "BANGBET",
  livescorebet: "LIVESCOREBET",
  cloudbet: "CLOUDBET",
  betbiga: "BETBIGA",
  paripesa: "PARIPESA",
  nairamillion: "NAIRAMILLION",
  mylottohub: "MYLOTTOHUB",
  betland: "BETLAND",
  betlion: "BETLION",
  supabet: "SUPABET",
  msport: "MSPORT",
  hallabet: "HALLABET",
};

/** ClubKonnect UserID looks like CK123 — never the literal string "your_userid". */
export function clubKonnectUserId() {
  const raw = (
    process.env.CLUBKONNECT_USER_ID ||
    process.env.NELLOBYTE_USER_ID ||
    ""
  ).trim();
  if (!raw || /^your[_-]?userid$/i.test(raw)) return "";
  return raw;
}

export function clubKonnectApiKey() {
  return (
    process.env.CLUBKONNECT_API_KEY ||
    process.env.NELLOBYTE_API_KEY ||
    ""
  ).trim();
}

export function clubKonnectBaseUrl() {
  return (
    process.env.CLUBKONNECT_BASE_URL ||
    "https://www.nellobytesystems.com"
  ).replace(/\/$/, "");
}

export function clubKonnectCallbackUrl() {
  return (process.env.CLUBKONNECT_CALLBACK_URL || "").trim();
}

export function hasClubKonnectKeys() {
  return Boolean(clubKonnectUserId() && clubKonnectApiKey());
}

export function clubKonnectCompanyCode(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return CLUBKONNECT_COMPANY_CODES[key] || key.toUpperCase();
}

type ClubJson = Record<string, unknown>;

async function getJson(url: string): Promise<ClubJson> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: ClubJson;
  try {
    json = JSON.parse(text) as ClubJson;
  } catch {
    const err = new Error(
      "ClubKonnect returned an invalid response",
    ) as Error & { status?: number };
    err.status = 503;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(
      String(json.status || json.message || "ClubKonnect request failed"),
    ) as Error & { status?: number };
    err.status = res.status >= 400 ? res.status : 503;
    throw err;
  }
  return json;
}

function authParams() {
  return {
    UserID: clubKonnectUserId(),
    APIKey: clubKonnectApiKey(),
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function humanStatus(status: string) {
  const map: Record<string, string> = {
    INVALID_CREDENTIALS: "Invalid ClubKonnect UserID or API key",
    MISSING_CREDENTIALS: "ClubKonnect credentials are incomplete",
    MISSING_USERID: "Set CLUBKONNECT_USER_ID (from ClubKonnect My Account / Developer API)",
    MISSING_APIKEY: "Set CLUBKONNECT_API_KEY",
    MISSING_BETTINGCOMPANY: "Unknown betting company code",
    MISSING_AMOUNT: "Enter a valid amount",
    INVALID_AMOUNT: "Enter a valid amount",
    MINIMUM_100: "Minimum funding is ₦100",
    MINIMUM_50000: "Minimum funding is ₦50,000 for this provider",
    INVALID_CUSTOMERID: "Invalid betting account ID",
    MISSING_PHONE_NUMBER:
      "Invalid ClubKonnect UserID — use your real UserID (e.g. CK123), not your_userid",
  };
  return map[status] || status.replace(/_/g, " ").toLowerCase();
}

export async function clubKonnectVerify(input: {
  serviceID: string;
  customerId: string;
}): Promise<{ ok: boolean; customerName: string | null; message?: string }> {
  const params = new URLSearchParams({
    ...authParams(),
    BettingCompany: clubKonnectCompanyCode(input.serviceID),
    CustomerID: input.customerId,
  });
  const url = `${clubKonnectBaseUrl()}/APIVerifyBettingV1.asp?${params}`;
  const json = await getJson(url);
  const name = String(json.customer_name || json.customername || "").trim();
  const status = String(json.status || json.statuscode || "").toUpperCase();

  if (status.includes("INVALID") || status.includes("MISSING")) {
    return {
      ok: false,
      customerName: null,
      message: humanStatus(status) || "Could not verify betting account",
    };
  }

  if (!name || /error|invalid/i.test(name)) {
    return {
      ok: false,
      customerName: null,
      message: "Could not verify betting account",
    };
  }

  return { ok: true, customerName: name };
}

async function clubKonnectQuery(input: {
  orderId?: string;
  requestId?: string;
}): Promise<{
  done: boolean;
  ok: boolean;
  reference: string;
  message?: string;
}> {
  const params = new URLSearchParams(authParams());
  if (input.orderId) params.set("OrderID", input.orderId);
  if (input.requestId) params.set("RequestID", input.requestId);

  const url = `${clubKonnectBaseUrl()}/APIQueryV1.asp?${params}`;
  const json = await getJson(url);
  const code = String(json.statuscode || "");
  const status = String(json.status || "").toUpperCase();
  const remark = String(json.remark || json.orderremark || "").trim();
  const reference = String(json.orderid || input.orderId || input.requestId || "");

  if (code === "200" || status === "ORDER_COMPLETED" || /success/i.test(status)) {
    return { done: true, ok: true, reference, message: remark || "Betting wallet funded" };
  }

  if (
    code === "100" ||
    status === "ORDER_RECEIVED" ||
    status === "ORDER_PROCESSING" ||
    status.includes("PENDING")
  ) {
    return { done: false, ok: true, reference };
  }

  return {
    done: true,
    ok: false,
    reference,
    message: remark || humanStatus(status) || "Betting funding failed",
  };
}

export async function clubKonnectFund(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  phone?: string | null;
}): Promise<{ ok: boolean; reference: string; message?: string }> {
  const params = new URLSearchParams({
    ...authParams(),
    BettingCompany: clubKonnectCompanyCode(input.serviceID),
    CustomerID: input.customerId,
    Amount: String(Math.round(input.amount)),
    RequestID: input.reference,
  });
  const callback = clubKonnectCallbackUrl();
  if (callback) params.set("CallBackURL", callback);
  const phone = (input.phone || "").replace(/\D/g, "");
  if (phone.length >= 10) params.set("Phone", phone.slice(-11));

  const url = `${clubKonnectBaseUrl()}/APIBettingV1.asp?${params}`;
  const json = await getJson(url);
  const code = String(json.statuscode || "");
  const status = String(json.status || "").toUpperCase();
  const orderId = String(json.orderid || "").trim();

  if (status.includes("INVALID") || status.includes("MISSING") || status.startsWith("MINIMUM_")) {
    return {
      ok: false,
      reference: input.reference,
      message: humanStatus(status) || "Betting funding failed",
    };
  }

  if (code === "200" || status === "ORDER_COMPLETED") {
    return {
      ok: true,
      reference: orderId || input.reference,
      message: "Betting wallet funded",
    };
  }

  // ORDER_RECEIVED / pending — poll until completed or timeout
  if (code === "100" || status === "ORDER_RECEIVED" || orderId) {
    const pollRef = orderId || input.reference;
    for (let i = 0; i < 8; i++) {
      await sleep(1500);
      const q = await clubKonnectQuery(
        orderId ? { orderId } : { requestId: input.reference },
      );
      if (q.done) {
        return {
          ok: q.ok,
          reference: q.reference || pollRef,
          message: q.message,
        };
      }
    }
    // Still pending after polls — treat as accepted (callback / later reconcile)
    return {
      ok: true,
      reference: pollRef,
      message: "Betting order received",
    };
  }

  return {
    ok: false,
    reference: orderId || input.reference,
    message: status || String(json.message || "Betting funding failed"),
  };
}
