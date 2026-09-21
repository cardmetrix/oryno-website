import { sogoErrorToEnglish } from "./errors";
import { isSogoDemoMode, sogoRequest } from "./client";
import type {
  SogoBillCatalog,
  SogoBillPlan,
  SogoBillProvider,
  SogoBillPurchaseData,
  SogoVerifyResult,
} from "./types";

const IMG = "https://vtpass.com/resources/products/200X200";

const NETWORK_IMAGES: Record<string, string> = {
  mtn: `${IMG}/MTN-Airtime.jpg`,
  airtel: `${IMG}/Airtel-Airtime.jpg`,
  glo: `${IMG}/GLO-Airtime.jpg`,
  t2mobile: `${IMG}/9mobile-Airtime.jpg`,
  "9mobile": `${IMG}/9mobile-Airtime.jpg`,
  etisalat: `${IMG}/9mobile-Airtime.jpg`,
  smile: `${IMG}/Smile-Payment.jpg`,
};

const DATA_IMAGES: Record<string, string> = {
  mtn: `${IMG}/MTN-Data.jpg`,
  airtel: `${IMG}/Airtel-Data.jpg`,
  glo: `${IMG}/GLO-Data.jpg`,
  t2mobile: `${IMG}/9mobile-Data.jpg`,
  "9mobile": `${IMG}/9mobile-Data.jpg`,
  smile: `${IMG}/Smile-Payment.jpg`,
};

const DISCO_IMAGES: Record<string, string> = {
  ikedc: `${IMG}/Ikeja-Electric-Payment-PHCN.jpg`,
  ekedc: `${IMG}/Eko-Electric-Payment-PHCN.jpg`,
  aedc: `${IMG}/Abuja-Electric.jpg`,
  kedco: `${IMG}/Kano-Electric.jpg`,
  phed: `${IMG}/Port-Harcourt-Electric.jpg`,
  jed: `${IMG}/Jos-Electric-JED.jpg`,
  kaedco: `${IMG}/Kaduna-Electric-KAEDCO.jpg`,
  eedc: `${IMG}/Enugu-Electric-EEDC.jpg`,
  ibedc: `${IMG}/Ibadan-Electric.jpg`,
  bedc: `${IMG}/Benin-Electricity-BEDC.jpg`,
  abedc: `${IMG}/Aba-Electric-Payment-ABEDC.jpg`,
  yedc: `${IMG}/Yola-Electric-Payment-IKEDC.jpg`,
};

const TV_IMAGES: Record<string, string> = {
  dstv: `${IMG}/Pay-DSTV-Subscription.jpg`,
  gotv: `${IMG}/Gotv-Payment.jpg`,
  startimes: `${IMG}/Startimes-Subscription.jpg`,
};

/** Old VTpass service IDs → Sogo slugs (mobile / cached clients). */
const LEGACY_NETWORK: Record<string, string> = {
  mtn: "mtn",
  "mtn-data": "mtn",
  airtel: "airtel",
  "airtel-data": "airtel",
  glo: "glo",
  "glo-data": "glo",
  "glo-sme-data": "glo",
  etisalat: "t2mobile",
  "etisalat-data": "t2mobile",
  "9mobile": "t2mobile",
  t2: "t2mobile",
  t2mobile: "t2mobile",
  smile: "smile",
  "smile-direct": "smile",
};

const LEGACY_DISCO: Record<string, string> = {
  "ikeja-electric": "ikedc",
  ikedc: "ikedc",
  "eko-electric": "ekedc",
  ekedc: "ekedc",
  "abuja-electric": "aedc",
  aedc: "aedc",
  "kano-electric": "kedco",
  kedco: "kedco",
  "portharcourt-electric": "phed",
  phed: "phed",
  "jos-electric": "jed",
  jed: "jed",
  "kaduna-electric": "kaedco",
  kaedco: "kaedco",
  "enugu-electric": "eedc",
  eedc: "eedc",
  "ibadan-electric": "ibedc",
  ibedc: "ibedc",
  "benin-electric": "bedc",
  bedc: "bedc",
  "aba-electric": "abedc",
  abedc: "abedc",
  "yola-electric": "yedc",
  yedc: "yedc",
};

const FALLBACK_AIRTIME: SogoBillProvider[] = [
  { slug: "mtn", name: "MTN" },
  { slug: "airtel", name: "Airtel" },
  { slug: "glo", name: "Glo" },
  { slug: "t2mobile", name: "T2" },
];

const FALLBACK_DATA: SogoBillProvider[] = [
  ...FALLBACK_AIRTIME,
  { slug: "smile", name: "Smile" },
];

const FALLBACK_TV: SogoBillProvider[] = [
  { slug: "dstv", name: "DSTV" },
  { slug: "gotv", name: "GOtv" },
  { slug: "startimes", name: "StarTimes" },
];

const FALLBACK_DISCOS: SogoBillProvider[] = [
  { slug: "ikedc", name: "IKEDC" },
  { slug: "ekedc", name: "EKEDC" },
  { slug: "aedc", name: "AEDC" },
  { slug: "kedco", name: "KEDCO" },
  { slug: "phed", name: "PHED" },
  { slug: "jed", name: "JED" },
  { slug: "kaedco", name: "KAEDCO" },
  { slug: "eedc", name: "EEDC" },
  { slug: "ibedc", name: "IBEDC" },
  { slug: "bedc", name: "BEDC" },
  { slug: "abedc", name: "ABEDC" },
  { slug: "yedc", name: "YEDC" },
];

const FALLBACK_DATA_PLANS: Record<string, SogoBillPlan[]> = {
  mtn: [
    { variationCode: "mtn-1gb-daily", name: "MTN 1GB — 1 day", amount: 500, fixedPrice: true },
    { variationCode: "mtn-2gb-weekly", name: "MTN 2.5GB — 7 days", amount: 1500, fixedPrice: true },
    { variationCode: "mtn-40gb-monthly", name: "MTN 40GB — 30 days", amount: 11000, fixedPrice: true },
  ],
  airtel: [
    { variationCode: "airtel-1gb-daily", name: "Airtel 1GB — 1 day", amount: 400, fixedPrice: true },
    { variationCode: "airtel-5gb-weekly", name: "Airtel 5GB — 7 days", amount: 2000, fixedPrice: true },
    { variationCode: "airtel-35gb-monthly", name: "Airtel 35GB — 30 days", amount: 10000, fixedPrice: true },
  ],
  glo: [
    { variationCode: "glo-2.5gb-daily", name: "Glo 2.5GB — 1 day", amount: 500, fixedPrice: true },
    { variationCode: "glo-7.5gb-weekly", name: "Glo 7.5GB — 7 days", amount: 2000, fixedPrice: true },
    { variationCode: "glo-50gb-monthly", name: "Glo 50GB — 30 days", amount: 10000, fixedPrice: true },
  ],
  t2mobile: [
    { variationCode: "t2-1gb-daily", name: "T2 1GB — 1 day", amount: 400, fixedPrice: true },
    { variationCode: "t2-4.5gb-weekly", name: "T2 4.5GB — 7 days", amount: 2000, fixedPrice: true },
    { variationCode: "t2-30gb-monthly", name: "T2 30GB — 30 days", amount: 9500, fixedPrice: true },
  ],
  smile: [
    { variationCode: "smile-1gb", name: "Smile 1GB Flexi", amount: 1000, fixedPrice: true },
    { variationCode: "smile-5gb", name: "Smile 5GB Flexi", amount: 4000, fixedPrice: true },
  ],
};

const FALLBACK_TV_PLANS: Record<string, SogoBillPlan[]> = {
  dstv: [
    { variationCode: "dstv-padi", name: "DStv Padi", amount: 1850, fixedPrice: true },
    { variationCode: "dstv-yanga", name: "DStv Yanga", amount: 2565, fixedPrice: true },
    { variationCode: "dstv-confam", name: "DStv Confam", amount: 4615, fixedPrice: true },
    { variationCode: "dstv79", name: "DStv Compact", amount: 7900, fixedPrice: true },
    { variationCode: "dstv3", name: "DStv Premium", amount: 18400, fixedPrice: true },
  ],
  gotv: [
    { variationCode: "gotv-smallie", name: "GOtv Smallie", amount: 1575, fixedPrice: true },
    { variationCode: "gotv-jinja", name: "GOtv Jinja", amount: 2700, fixedPrice: true },
    { variationCode: "gotv-jolli", name: "GOtv Jolli", amount: 3950, fixedPrice: true },
    { variationCode: "gotv-max", name: "GOtv Max", amount: 5700, fixedPrice: true },
  ],
  startimes: [
    { variationCode: "nova", name: "Nova", amount: 1700, fixedPrice: true },
    { variationCode: "basic", name: "Basic", amount: 3000, fixedPrice: true },
    { variationCode: "smart", name: "Smart", amount: 3800, fixedPrice: true },
    { variationCode: "classic", name: "Classic", amount: 5500, fixedPrice: true },
  ],
};

const METER_TYPES: SogoBillPlan[] = [
  { variationCode: "prepaid", name: "Prepaid", amount: 0, fixedPrice: false },
  { variationCode: "postpaid", name: "Postpaid", amount: 0, fixedPrice: false },
];

export function normalizeSogoNetwork(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return LEGACY_NETWORK[key] || key.replace(/-data$/, "");
}

export function normalizeSogoDisco(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return LEGACY_DISCO[key] || key;
}

export function normalizeSogoTvProvider(serviceID: string) {
  return serviceID.trim().toLowerCase().replace(/-subscription$/, "");
}

/** Sogo expects 080XXXXXXXX (or +234…). */
export function toSogoPhone(phone: string) {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234") && digits.length >= 13) {
    digits = `0${digits.slice(3)}`;
  }
  if (digits.length === 10 && !digits.startsWith("0")) {
    digits = `0${digits}`;
  }
  return digits;
}

export function displayNetworkName(slug: string, fallback?: string) {
  const key = slug.toLowerCase();
  if (key === "t2mobile" || key === "t2" || key === "9mobile" || key === "etisalat") {
    return "T2";
  }
  if (fallback) return fallback;
  return slug.toUpperCase();
}

function providerImage(kind: "airtime" | "data" | "tv" | "electricity", slug: string) {
  if (kind === "airtime") return NETWORK_IMAGES[slug] ?? null;
  if (kind === "data") return DATA_IMAGES[slug] ?? NETWORK_IMAGES[slug] ?? null;
  if (kind === "tv") return TV_IMAGES[slug] ?? null;
  return DISCO_IMAGES[slug] ?? null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  if (!rec) return [];
  if (Array.isArray(rec.data)) return rec.data;
  if (Array.isArray(rec.plans)) return rec.plans;
  if (Array.isArray(rec.packages)) return rec.packages;
  if (Array.isArray(rec.providers)) return rec.providers;
  const nested = Object.values(rec).find((v) => Array.isArray(v));
  return Array.isArray(nested) ? nested : [];
}

function pickString(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
  }
  return "";
}

function pickNumber(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
      const n = Number(v.replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

function normalizeProvider(raw: unknown): SogoBillProvider | null {
  const row = asRecord(raw);
  if (!row) return null;
  const slug = pickString(row, ["slug", "code", "id", "provider", "network"]).toLowerCase();
  if (!slug) return null;
  const name = displayNetworkName(
    slug,
    pickString(row, ["name", "label", "title"]) || undefined,
  );
  return { slug, name };
}

function catalogGroup(
  catalog: unknown,
  keys: string[],
): SogoBillProvider[] {
  if (Array.isArray(catalog)) {
    const match = catalog.find((row) => {
      const rec = asRecord(row);
      const type = String(rec?.type || rec?.slug || rec?.id || "").toLowerCase();
      return keys.includes(type);
    });
    const rec = asRecord(match);
    return asArray(rec?.providers)
      .map(normalizeProvider)
      .filter(Boolean) as SogoBillProvider[];
  }

  const root = asRecord(catalog);
  if (!root) return [];
  for (const key of keys) {
    const group = asRecord(root[key]);
    if (!group) continue;
    const providers = asArray(group.providers ?? group)
      .map(normalizeProvider)
      .filter(Boolean) as SogoBillProvider[];
    if (providers.length) return providers;
  }
  return [];
}

function decorate(
  providers: SogoBillProvider[],
  kind: "airtime" | "data" | "tv" | "electricity",
) {
  return providers.map((p) => ({
    ...p,
    name: displayNetworkName(p.slug, p.name),
    image: p.image || providerImage(kind, p.slug),
  }));
}

export async function fetchSogoBillsCatalog(): Promise<unknown> {
  if (isSogoDemoMode()) {
    return {
      airtime: { label: "Airtime", providers: FALLBACK_AIRTIME },
      data: { label: "Data", providers: FALLBACK_DATA },
      electricity: { label: "Electricity", providers: FALLBACK_DISCOS },
      cable_tv: { label: "Cable TV", providers: FALLBACK_TV },
    };
  }

  const json = await sogoRequest<{ data?: SogoBillCatalog } | SogoBillCatalog>(
    "/bills/catalog",
  );
  const data = asRecord(json)?.data ?? json;
  if (Array.isArray(data) || (data && typeof data === "object")) {
    return data;
  }
  return {};
}

export async function listSogoBillServices(
  identifier: "airtime" | "data" | "tv-subscription" | "electricity-bill",
) {
  try {
    const catalog = await fetchSogoBillsCatalog();
    if (identifier === "airtime") {
      const list = catalogGroup(catalog, ["airtime"]) || FALLBACK_AIRTIME;
      return decorate(list.length ? list : FALLBACK_AIRTIME, "airtime");
    }
    if (identifier === "data") {
      const list = catalogGroup(catalog, ["data"]);
      return decorate(list.length ? list : FALLBACK_DATA, "data");
    }
    if (identifier === "tv-subscription") {
      const list = catalogGroup(catalog, ["cable_tv", "cable-tv", "tv"]);
      return decorate(list.length ? list : FALLBACK_TV, "tv");
    }
    const list = catalogGroup(catalog, ["electricity"]);
    return decorate(list.length ? list : FALLBACK_DISCOS, "electricity");
  } catch (error) {
    console.error("[sogo-bills-catalog]", error);
    if (identifier === "airtime") return decorate(FALLBACK_AIRTIME, "airtime");
    if (identifier === "data") return decorate(FALLBACK_DATA, "data");
    if (identifier === "tv-subscription") return decorate(FALLBACK_TV, "tv");
    return decorate(FALLBACK_DISCOS, "electricity");
  }
}

function normalizePlan(raw: unknown): SogoBillPlan | null {
  const row = asRecord(raw);
  if (!row) return null;
  const variationCode = pickString(row, [
    "variation_code",
    "variationCode",
    "code",
    "plan_code",
    "planCode",
    "id",
    "slug",
  ]);
  if (!variationCode) return null;
  const name =
    pickString(row, ["name", "plan_name", "title", "description", "label"]) ||
    variationCode;
  const amount = pickNumber(row, [
    "amount",
    "price",
    "variation_amount",
    "charged_amount",
    "monthly_price",
  ]);
  const fixedVal = row.fixedPrice ?? row.fixed_price ?? row.fixed;
  const fixedPrice =
    typeof fixedVal === "boolean"
      ? fixedVal
      : typeof fixedVal === "string"
        ? ["yes", "true", "1"].includes(fixedVal.toLowerCase())
        : amount > 0;
  return {
    variationCode,
    name,
    amount,
    fixedPrice,
    validity: pickString(row, ["validity", "validity_period", "duration"]) || null,
    size: pickString(row, ["size", "bundle_size", "data_size"]) || null,
  };
}

function plansFromPayload(json: unknown, network?: string): SogoBillPlan[] {
  const root = asRecord(json);
  const data = root?.data ?? json;
  const rec = asRecord(data);
  let rows: unknown[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (rec) {
    if (network && Array.isArray(rec[network])) {
      rows = rec[network] as unknown[];
    } else {
      rows = asArray(data);
    }
  }
  return rows.map(normalizePlan).filter(Boolean) as SogoBillPlan[];
}

export async function fetchSogoDataPlans(network: string): Promise<SogoBillPlan[]> {
  const slug = normalizeSogoNetwork(network);
  if (isSogoDemoMode()) {
    return FALLBACK_DATA_PLANS[slug] || FALLBACK_DATA_PLANS.mtn;
  }
  try {
    const json = await sogoRequest<unknown>(
      `/bills/data-plans?network=${encodeURIComponent(slug)}`,
    );
    const plans = plansFromPayload(json, slug);
    return plans.length ? plans : FALLBACK_DATA_PLANS[slug] || [];
  } catch (error) {
    console.error("[sogo-data-plans]", error);
    return FALLBACK_DATA_PLANS[slug] || [];
  }
}

export async function fetchSogoCablePackages(provider: string): Promise<SogoBillPlan[]> {
  const slug = normalizeSogoTvProvider(provider);
  if (isSogoDemoMode()) {
    return FALLBACK_TV_PLANS[slug] || [];
  }
  try {
    const json = await sogoRequest<unknown>(
      `/bills/cable-packages?provider=${encodeURIComponent(slug)}`,
    );
    const plans = plansFromPayload(json, slug);
    return plans.length ? plans : FALLBACK_TV_PLANS[slug] || [];
  } catch (error) {
    console.error("[sogo-cable-packages]", error);
    return FALLBACK_TV_PLANS[slug] || [];
  }
}

export async function listSogoVariations(input: {
  identifier?: "airtime" | "data" | "tv-subscription" | "electricity-bill";
  serviceID: string;
}): Promise<{ serviceName: string; variations: SogoBillPlan[] }> {
  const id = input.serviceID;
  const kind = input.identifier;

  if (kind === "electricity-bill") {
    return {
      serviceName: displayNetworkName(normalizeSogoDisco(id), id),
      variations: METER_TYPES,
    };
  }

  if (kind === "tv-subscription") {
    const slug = normalizeSogoTvProvider(id);
    return {
      serviceName: displayNetworkName(slug, id),
      variations: await fetchSogoCablePackages(slug),
    };
  }

  if (kind === "data" || kind === "airtime") {
    const network = normalizeSogoNetwork(id);
    return {
      serviceName: displayNetworkName(network, id),
      variations: kind === "data" ? await fetchSogoDataPlans(network) : [],
    };
  }

  if (
    LEGACY_DISCO[id.toLowerCase()] ||
    Object.values(LEGACY_DISCO).includes(id.toLowerCase())
  ) {
    return {
      serviceName: displayNetworkName(normalizeSogoDisco(id), id),
      variations: METER_TYPES,
    };
  }

  if (FALLBACK_TV_PLANS[normalizeSogoTvProvider(id)]) {
    const slug = normalizeSogoTvProvider(id);
    return {
      serviceName: displayNetworkName(slug, id),
      variations: await fetchSogoCablePackages(slug),
    };
  }

  const network = normalizeSogoNetwork(id);
  return {
    serviceName: displayNetworkName(network, id),
    variations: await fetchSogoDataPlans(network),
  };
}

export async function lookupSogoPlanAmount(input: {
  kind: "data" | "tv";
  serviceID: string;
  variationCode: string;
  fallbackAmount: number;
}) {
  const plans =
    input.kind === "tv"
      ? await fetchSogoCablePackages(input.serviceID)
      : await fetchSogoDataPlans(input.serviceID);
  const match = plans.find((p) => p.variationCode === input.variationCode);
  if (match && match.amount > 0) return match.amount;
  return input.fallbackAmount;
}

export async function verifySogoMeter(input: {
  discoSlug: string;
  meterNumber: string;
  meterType: "prepaid" | "postpaid";
}) {
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live bill verification. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }

  const json = await sogoRequest<SogoVerifyResult>(
    "/bills/electricity/verify-meter",
    {
      method: "POST",
      body: JSON.stringify({
        disco_slug: normalizeSogoDisco(input.discoSlug),
        meter_number: input.meterNumber,
        meter_type: input.meterType,
      }),
    },
  );
  const v = json.verification || {};
  return {
    customerName:
      v.customer_name ||
      (typeof json.customer_name === "string" ? json.customer_name : "") ||
      "",
    customerAddress: typeof v.address === "string" ? v.address : "",
    meterNumber:
      (typeof v.meter_number === "string" ? v.meter_number : "") ||
      input.meterNumber,
    meterType:
      (typeof v.meter_type === "string" ? v.meter_type : "") || input.meterType,
  };
}

export async function verifySogoSmartcard(input: {
  provider: string;
  smartcardNumber: string;
}) {
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live bill verification. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }

  const json = await sogoRequest<SogoVerifyResult>(
    "/bills/cable-tv/verify-smartcard",
    {
      method: "POST",
      body: JSON.stringify({
        provider: normalizeSogoTvProvider(input.provider),
        smartcard_number: input.smartcardNumber,
      }),
    },
  );
  const v = json.verification || {};
  const renewal = Number(v.renewal_amount);
  return {
    customerName:
      v.customer_name ||
      (typeof json.customer_name === "string" ? json.customer_name : "") ||
      "",
    currentBouquet:
      typeof v.current_bouquet === "string" ? v.current_bouquet : undefined,
    renewalAmount: Number.isFinite(renewal) && renewal > 0 ? renewal : undefined,
  };
}

function demoPurchase(input: {
  type: string;
  referenceHint: string;
  amount: number;
  extra?: Record<string, unknown>;
}): SogoBillPurchaseData {
  const tail = input.referenceHint.replace(/\D/g, "").slice(-4);
  let status = "completed";
  if (tail === "0000") status = "refunded";
  else if (tail === "9999") status = "processing";
  return {
    reference: `DEMO${input.type.slice(0, 3).toUpperCase()}${Date.now().toString(36).toUpperCase()}`.slice(0, 24),
    status,
    type: input.type,
    amount: input.amount,
    fee: 0,
    total: input.amount,
    created_at: new Date().toISOString(),
    ...input.extra,
  };
}

export function extractSogoToken(data?: Record<string, unknown> | null) {
  if (!data) return null;
  const keys = [
    "token",
    "prepaid_token",
    "token_code",
    "purchased_code",
    "electricity_token",
  ];
  const bags = [
    data,
    asRecord(data.meta),
    asRecord(data.metadata),
  ].filter(Boolean) as Record<string, unknown>[];
  for (const bag of bags) {
    for (const key of keys) {
      const v = bag[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

function enumValue(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  if (rec && rec.value != null) return String(rec.value);
  return "";
}

function moneyValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  const rec = asRecord(value);
  if (!rec) return 0;
  return pickNumber(rec, ["raw", "amount"]);
}

/**
 * OpenAPI (`partner-v1`) returns `{ message, transaction }`.
 * Marketing docs sometimes show `{ data }`. Accept both and flatten
 * `status.value` / `amount.raw`.
 */
export function parseSogoBillPurchase(json: unknown): SogoBillPurchaseData {
  const rec = asRecord(json) || {};
  const tx =
    asRecord(rec.transaction) ||
    asRecord(rec.data) ||
    rec;
  const meta = asRecord(tx.metadata) || asRecord(tx.meta) || {};
  const status = enumValue(tx.status) || enumValue(rec.status);
  const reference =
    pickString(tx, ["reference", "id"]) ||
    pickString(rec, ["reference"]);
  if (!reference && !status) {
    throw new Error(
      sogoErrorToEnglish(
        pickString(rec, ["message"]) || "Purchase failed",
      ),
    );
  }
  const token = extractSogoToken({ ...tx, metadata: meta, meta });
  return {
    ...tx,
    reference,
    status: status.toLowerCase(),
    type: enumValue(tx.type) || pickString(tx, ["type"]),
    network:
      pickString(tx, ["network"]) ||
      pickString(meta, ["network"]),
    phone:
      pickString(tx, ["phone", "phone_number"]) ||
      pickString(meta, ["phone_number", "phone"]),
    amount: moneyValue(tx.amount),
    fee: moneyValue(tx.fee),
    total: moneyValue(tx.net_amount) || moneyValue(tx.amount),
    token,
    prepaid_token: token,
    token_code: token,
    created_at:
      pickString(tx, ["created_at"]) ||
      pickString(asRecord(tx.timestamps) || {}, ["created_at"]),
    metadata: meta,
  };
}

export function mapSogoBillStatus(
  status?: string | { value?: string } | null,
) {
  const s = enumValue(status).toLowerCase();
  if (s === "completed" || s === "success" || s === "delivered") {
    return "completed" as const;
  }
  if (s === "processing" || s === "pending" || s === "initiated") {
    return "processing" as const;
  }
  if (s === "refunded" || s === "cancelled" || s === "failed") {
    return "failed" as const;
  }
  return "processing" as const;
}

export async function submitSogoAirtime(input: {
  network: string;
  phone: string;
  amount: number;
  idempotencyKey: string;
}): Promise<{ data: SogoBillPurchaseData; simulated: boolean }> {
  const network = normalizeSogoNetwork(input.network);
  const phone = toSogoPhone(input.phone);
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live purchases. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }
  const json = await sogoRequest<unknown>("/bills/airtime", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      network,
      phone,
      amount: Math.round(input.amount),
      currency: "NGN",
    }),
  });
  return { data: parseSogoBillPurchase(json), simulated: false };
}

export async function submitSogoData(input: {
  network: string;
  phone: string;
  variationCode: string;
  amount?: number;
  idempotencyKey: string;
}): Promise<{ data: SogoBillPurchaseData; simulated: boolean }> {
  const network = normalizeSogoNetwork(input.network);
  const phone = toSogoPhone(input.phone);
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live purchases. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }
  const json = await sogoRequest<unknown>("/bills/data", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      network,
      phone,
      variation_code: input.variationCode,
    }),
  });
  return { data: parseSogoBillPurchase(json), simulated: false };
}

export async function submitSogoElectricity(input: {
  discoSlug: string;
  meterNumber: string;
  meterType: "prepaid" | "postpaid";
  amount: number;
  idempotencyKey: string;
}): Promise<{ data: SogoBillPurchaseData; simulated: boolean }> {
  const disco = normalizeSogoDisco(input.discoSlug);
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live purchases. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }
  const json = await sogoRequest<unknown>("/bills/electricity", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      disco_slug: disco,
      meter_number: input.meterNumber,
      meter_type: input.meterType,
      amount: Math.round(input.amount),
      currency: "NGN",
    }),
  });
  return { data: parseSogoBillPurchase(json), simulated: false };
}

export async function submitSogoCableTv(input: {
  provider: string;
  smartcardNumber: string;
  variationCode: string;
  amount: number;
  subscriptionType?: string;
  idempotencyKey: string;
}): Promise<{ data: SogoBillPurchaseData; simulated: boolean }> {
  const provider = normalizeSogoTvProvider(input.provider);
  if (isSogoDemoMode()) {
    throw new Error(
      "Sogo is not configured for live purchases. Set SOGO_SECRET_KEY and ensure SOGO_DEMO is false.",
    );
  }
  const json = await sogoRequest<unknown>("/bills/cable-tv", {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    body: JSON.stringify({
      provider,
      smartcard_number: input.smartcardNumber,
      subscription_type: input.subscriptionType || "renew",
      variation_code: input.variationCode,
      amount: Math.round(input.amount),
      currency: "NGN",
    }),
  });
  return { data: parseSogoBillPurchase(json), simulated: false };
}
