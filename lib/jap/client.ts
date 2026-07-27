/**
 * JustAnotherPanel (JAP) API client
 * Docs: https://justanotherpanel.com/api
 * Endpoint: POST https://justanotherpanel.com/api/v2
 */

const DEFAULT_BASE = "https://justanotherpanel.com/api/v2";

export function japApiKey() {
  return (process.env.JAP_API_KEY || "").trim();
}

export function japBaseUrl() {
  return (
    process.env.JAP_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE
  );
}

export function hasJapKeys() {
  return Boolean(japApiKey());
}

export function isJapDemoMode() {
  return !hasJapKeys();
}

/** Retail markup on top of FX buy rate (default 30%). */
export function japMarkup() {
  const raw = Number(process.env.JAP_MARKUP || "1.30");
  return Number.isFinite(raw) && raw >= 1 ? raw : 1.30;
}

export type JapService = {
  service: number;
  name: string;
  type: string;
  category: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
};

export type JapOrderStatus = {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  currency?: string;
  error?: string;
};

async function japPost(params: Record<string, string | number>) {
  const key = japApiKey();
  if (!key) throw new Error("JAP_API_KEY is not configured");

  const body = new URLSearchParams();
  body.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    body.set(k, String(v));
  }

  const res = await fetch(japBaseUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(text || `JAP error (${res.status})`);
  }

  if (
    json &&
    typeof json === "object" &&
    "error" in json &&
    (json as { error?: string }).error
  ) {
    throw new Error(String((json as { error: string }).error));
  }

  if (!res.ok) {
    throw new Error(`JAP error (${res.status})`);
  }

  return json;
}

export async function getJapBalance() {
  const json = (await japPost({ action: "balance" })) as {
    balance?: string;
    currency?: string;
  };
  return {
    balance: Number(json.balance) || 0,
    currency: json.currency || "USD",
  };
}

export async function getJapServices(): Promise<JapService[]> {
  const json = await japPost({ action: "services" });
  if (!Array.isArray(json)) throw new Error("Failed to load JAP services");

  return json
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        service: Number(r.service),
        name: String(r.name ?? ""),
        type: String(r.type ?? "Default"),
        category: String(r.category ?? "Other"),
        rate: Number(r.rate) || 0,
        min: Number(r.min) || 1,
        max: Number(r.max) || 100000,
        refill: Boolean(r.refill),
        cancel: Boolean(r.cancel),
      } satisfies JapService;
    })
    .filter((s) => Number.isFinite(s.service) && s.service > 0 && s.name);
}

export async function addJapOrder(input: {
  service: number;
  link: string;
  quantity: number;
}) {
  const json = (await japPost({
    action: "add",
    service: input.service,
    link: input.link,
    quantity: input.quantity,
  })) as { order?: number | string };

  if (json.order == null) throw new Error("No order id returned from JAP");
  return { orderId: String(json.order) };
}

export async function getJapOrderStatus(orderId: string): Promise<JapOrderStatus> {
  const json = (await japPost({
    action: "status",
    order: orderId,
  })) as JapOrderStatus;
  return json;
}
