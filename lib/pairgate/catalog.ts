/**
 * Pairgate NG catalogs: airtime, data, cable TV, electricity.
 * Docs: https://pairgate.com/developers/introduction
 */

import {
  isPairgateHttpOk,
  isPairgateSandbox,
  pairgateApiPath,
  pairgateErrorMessage,
  pairgateFetch,
} from "./http";

const IMG = "https://vtpass.com/resources/products/200X200";

export type PairgateService = {
  serviceID: string;
  name: string;
  image: string;
  minAmount?: number;
  maxAmount?: number;
};

export type PairgateVariation = {
  variation_code: string;
  name: string;
  variation_amount: string;
  fixedPrice: string;
  charged_amount?: number;
};

const AIRTIME_NETWORKS: PairgateService[] = [
  {
    serviceID: "mtn",
    name: "MTN",
    image: `${IMG}/MTN-Airtime.jpg`,
    minAmount: 50,
    maxAmount: 50000,
  },
  {
    serviceID: "airtel",
    name: "Airtel",
    image: `${IMG}/Airtel-Airtime.jpg`,
    minAmount: 50,
    maxAmount: 50000,
  },
  {
    serviceID: "glo",
    name: "Glo",
    image: `${IMG}/GLO-Airtime.jpg`,
    minAmount: 50,
    maxAmount: 50000,
  },
  {
    serviceID: "9mobile",
    name: "9mobile",
    image: `${IMG}/9mobile-Airtime.jpg`,
    minAmount: 50,
    maxAmount: 50000,
  },
];

const DATA_NETWORKS: PairgateService[] = [
  { serviceID: "mtn", name: "MTN Data", image: `${IMG}/MTN-Data.jpg` },
  { serviceID: "airtel", name: "Airtel Data", image: `${IMG}/Airtel-Data.jpg` },
  { serviceID: "glo", name: "Glo Data", image: `${IMG}/GLO-Data.jpg` },
  { serviceID: "9mobile", name: "9mobile Data", image: `${IMG}/9mobile-Data.jpg` },
];

const TV_PROVIDERS: PairgateService[] = [
  { serviceID: "dstv", name: "DStv", image: `${IMG}/DStv.jpg` },
  { serviceID: "gotv", name: "GOtv", image: `${IMG}/GOtv.jpg` },
  { serviceID: "startimes", name: "StarTimes", image: `${IMG}/Startimes.jpg` },
];

const ELECTRICITY_PROVIDERS: PairgateService[] = [
  {
    serviceID: "ikedc",
    name: "Ikeja Electricity - IKEDC",
    image: `${IMG}/Ikeja-Electric-Payment-PHCN.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "eko",
    name: "Eko Electricity - EKEDC",
    image: `${IMG}/Eko-Electric-Payment-PHCN.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "aedc",
    name: "Abuja Electricity - AEDC",
    image: `${IMG}/Abuja-Electric.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "kedco",
    name: "Kano Electricity - KEDCO",
    image: `${IMG}/Kano-Electric.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "ph",
    name: "Port Harcourt Electricity - PHEDC",
    image: `${IMG}/Port-Harcourt-Electric.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "jedc",
    name: "Jos Electricity - JEDC",
    image: `${IMG}/Jos-Electric-JED.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "kaduna",
    name: "Kaduna Electricity - KAEDC",
    image: `${IMG}/Kaduna-Electric-KAEDCO.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "enugu",
    name: "Enugu Electricity - EEDC",
    image: `${IMG}/Enugu-Electric-EEDC.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "ibedc",
    name: "Ibadan Electricity - IBEDC",
    image: `${IMG}/Ibadan-Electric.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "benin",
    name: "Benin Electricity - BEDC",
    image: `${IMG}/Benin-Electricity-BEDC.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "aba",
    name: "Aba Electricity - ABA",
    image: `${IMG}/Aba-Electric-Payment-ABEDC.jpg`,
    minAmount: 1000,
  },
  {
    serviceID: "yola",
    name: "Yola Electricity - YEDC",
    image: `${IMG}/Yola-Electric-Payment-IKEDC.jpg`,
    minAmount: 1000,
  },
];

/** Map VTpass / legacy service IDs → Pairgate slugs. */
const NETWORK_SLUG: Record<string, string> = {
  mtn: "mtn",
  "mtn-data": "mtn",
  airtel: "airtel",
  "airtel-data": "airtel",
  glo: "glo",
  "glo-data": "glo",
  "glo-sme-data": "glo",
  // Legacy / alternate IDs → Pairgate provider slug (`9mobile`).
  etisalat: "9mobile",
  "etisalat-data": "9mobile",
  "9mobile": "9mobile",
  t2: "9mobile",
  t2mobile: "9mobile",
  "t2-data": "9mobile",
};

const TV_SLUG: Record<string, string> = {
  dstv: "dstv",
  gotv: "gotv",
  startimes: "startimes",
};

const DISCO_SLUG: Record<string, string> = {
  ikedc: "ikedc",
  "ikeja-electric": "ikedc",
  eko: "eko",
  ekedc: "eko",
  "eko-electric": "eko",
  aedc: "aedc",
  "abuja-electric": "aedc",
  kedco: "kedco",
  "kano-electric": "kedco",
  ph: "ph",
  phed: "ph",
  "portharcourt-electric": "ph",
  jedc: "jedc",
  jed: "jedc",
  "jos-electric": "jedc",
  kaduna: "kaduna",
  kaedco: "kaduna",
  "kaduna-electric": "kaduna",
  enugu: "enugu",
  eedc: "enugu",
  "enugu-electric": "enugu",
  ibedc: "ibedc",
  "ibadan-electric": "ibedc",
  benin: "benin",
  bedc: "benin",
  "benin-electric": "benin",
  aba: "aba",
  abedc: "aba",
  "aba-electric": "aba",
  yola: "yola",
  yedc: "yola",
  "yola-electric": "yola",
};

export function normalizePairgateNetwork(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return NETWORK_SLUG[key] || key.replace(/-data$/, "").replace(/-sme-data$/, "");
}

export function normalizePairgateTv(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return TV_SLUG[key] || key;
}

export function normalizePairgateDisco(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return DISCO_SLUG[key] || key;
}

export function pairgateMeterType(variationCode?: string | null): 1 | 2 {
  const v = String(variationCode || "prepaid").toLowerCase();
  return v === "postpaid" || v === "2" ? 2 : 1;
}

export function listAirtimeServices(): PairgateService[] {
  return AIRTIME_NETWORKS;
}

export function listDataServices(): PairgateService[] {
  return DATA_NETWORKS;
}

export function listTvServices(): PairgateService[] {
  return TV_PROVIDERS;
}

export function listElectricityServices(): PairgateService[] {
  return ELECTRICITY_PROVIDERS;
}

function plansFromGroupedData(
  data: Record<string, unknown>,
  planType?: string,
): PairgateVariation[] {
  const out: PairgateVariation[] = [];
  for (const value of Object.values(data)) {
    if (!Array.isArray(value)) continue;
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const plan = raw as Record<string, unknown>;
      const planId = String(plan.plan_id ?? plan.id ?? "").trim();
      if (!planId) continue;
      const name = String(plan.name || planId).trim();
      const price = Number(plan.price) || 0;
      const duration =
        plan.duration != null ? String(plan.duration).trim() : "";
      const withDuration =
        duration && !/\bday/i.test(name)
          ? `${name} · ${duration} day${duration === "1" ? "" : "s"}`
          : name;
      const label =
        planType && !withDuration.includes(`(${planType})`)
          ? `${withDuration} (${planType})`
          : withDuration;
      out.push({
        variation_code: planId,
        name: label,
        variation_amount: String(price),
        fixedPrice: "Yes",
        charged_amount: price,
      });
    }
  }
  return out;
}

/** Use shared pairgateFetch queue (rate-limited in http.ts). */
async function pairgateCatalogGet(path: string) {
  return pairgateFetch(path, { method: "GET" });
}

type DataPlanCache = {
  expiresAt: number;
  serviceName: string;
  variations: PairgateVariation[];
  complete: boolean;
};
const dataPlanCache = new Map<string, DataPlanCache>();
/** Keep catalogs warm longer — plan prices change infrequently. */
const DATA_PLAN_CACHE_MS = 30 * 60 * 1000;
/** All Pairgate plan types — fetch every type before responding so the UI is complete. */
const ALL_PLAN_TYPES = ["CG", "SME", "GIFTING", "CG_LITE", "AWOOF"] as const;
const inflightDataPlans = new Map<
  string,
  Promise<{ serviceName: string; variations: PairgateVariation[] }>
>();
let catalogWarmStarted = false;

async function fetchDataPlansForType(
  slug: string,
  planType: string,
): Promise<{ plans: PairgateVariation[]; ok: boolean }> {
  // Always use live catalog paths — /test/data-plans returns empty arrays
  const path = `/data-plans?provider_id=${encodeURIComponent(slug)}&plan_type=${encodeURIComponent(planType)}`;
  try {
    const { ok, status, json } = await pairgateCatalogGet(path);
    if (status === 429) {
      console.error("[pairgate-data-plans] rate-limited", slug, planType);
      return { plans: [], ok: false };
    }
    if (!isPairgateHttpOk(ok, status, json) || !json.data) {
      return { plans: [], ok: false };
    }
    return {
      plans: plansFromGroupedData(
        json.data as Record<string, unknown>,
        planType,
      ),
      ok: true,
    };
  } catch (error) {
    console.error("[pairgate-data-plans]", slug, planType, error);
    return { plans: [], ok: false };
  }
}

/** Plan types Pairgate lists for this provider (avoids empty CG/AWOOF calls that burn rate limit). */
async function planTypesForProvider(slug: string): Promise<string[] | null> {
  try {
    const { ok, status, json } = await pairgateCatalogGet(
      "/data-plans/categories",
    );
    if (!isPairgateHttpOk(ok, status, json) || !Array.isArray(json.data)) {
      return null;
    }
    const aliases = new Set(
      slug === "9mobile"
        ? ["9mobile", "t2", "t2mobile"]
        : [slug],
    );
    const types = new Set<string>();
    for (const row of json.data as unknown[]) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const nameSlug = String(rec.provider_name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      if (!aliases.has(nameSlug)) continue;
      const planType = String(rec.plan_type || "").trim().toUpperCase();
      if (planType) types.add(planType);
    }
    return types.size ? [...types] : null;
  } catch (error) {
    console.error("[pairgate-data-categories]", slug, error);
    return null;
  }
}

function mergePlanBatches(
  batches: PairgateVariation[][],
): PairgateVariation[] {
  const variations: PairgateVariation[] = [];
  const seen = new Set<string>();
  for (const batch of batches) {
    for (const v of batch) {
      if (seen.has(v.variation_code)) continue;
      seen.add(v.variation_code);
      variations.push(v);
    }
  }
  variations.sort(
    (a, b) => (Number(a.charged_amount) || 0) - (Number(b.charged_amount) || 0),
  );
  return variations;
}

function writeDataPlanCache(
  slug: string,
  serviceName: string,
  variations: PairgateVariation[],
  complete: boolean,
) {
  dataPlanCache.set(slug, {
    expiresAt: Date.now() + DATA_PLAN_CACHE_MS,
    serviceName,
    variations,
    complete,
  });
}

function displayNetworkServiceName(slug: string) {
  const match = DATA_NETWORKS.find(
    (s) => normalizePairgateNetwork(s.serviceID) === slug,
  );
  return match?.name || (slug === "9mobile" ? "9mobile Data" : slug.toUpperCase());
}

async function loadDataVariationsFresh(
  slug: string,
  serviceName: string,
): Promise<{ serviceName: string; variations: PairgateVariation[] }> {
  const fromCategories = await planTypesForProvider(slug);
  const planTypes = fromCategories?.length
    ? fromCategories
    : [...ALL_PLAN_TYPES];

  const batches: PairgateVariation[][] = [];
  let allOk = true;
  for (const planType of planTypes) {
    const result = await fetchDataPlansForType(slug, planType);
    if (!result.ok) allOk = false;
    batches.push(result.plans);
  }
  const variations = mergePlanBatches(batches);
  // Only mark complete when every request succeeded — otherwise a 429 empty
  // response would stick for 30 minutes and show "no plans" for 9mobile.
  writeDataPlanCache(slug, serviceName, variations, allOk);
  return { serviceName, variations };
}

export async function listDataVariations(
  providerSlug: string,
): Promise<{ serviceName: string; variations: PairgateVariation[] }> {
  const slug = normalizePairgateNetwork(providerSlug);
  const serviceName = displayNetworkServiceName(slug);

  const cached = dataPlanCache.get(slug);
  // Only serve cache hits that finished loading every plan type.
  if (cached && cached.complete && cached.expiresAt > Date.now()) {
    return {
      serviceName: cached.serviceName,
      variations: cached.variations,
    };
  }

  // Stale-while-revalidate: serve any non-empty catalog instantly while refreshing.
  if (cached?.variations.length) {
    if (!inflightDataPlans.has(slug)) {
      const refresh = loadDataVariationsFresh(slug, serviceName).finally(() => {
        inflightDataPlans.delete(slug);
      });
      inflightDataPlans.set(slug, refresh);
    }
    return {
      serviceName: cached.serviceName,
      variations: cached.variations,
    };
  }

  const existing = inflightDataPlans.get(slug);
  if (existing) return existing;

  const load = loadDataVariationsFresh(slug, serviceName).finally(() => {
    inflightDataPlans.delete(slug);
  });
  inflightDataPlans.set(slug, load);
  return load;
}

/**
 * Warm MTN/Airtel/Glo/9mobile catalogs in the background (non-blocking).
 * Call when the data services list is requested so the first plan view is a cache hit.
 */
export function warmDataPlanCatalog(prioritySlug?: string | null) {
  if (catalogWarmStarted && !prioritySlug) return;
  catalogWarmStarted = true;

  const networks = DATA_NETWORKS.map((n) => n.serviceID);
  const priority = prioritySlug
    ? normalizePairgateNetwork(prioritySlug)
    : null;
  const ordered = priority
    ? [
        priority,
        ...networks.filter(
          (id) => normalizePairgateNetwork(id) !== priority,
        ),
      ]
    : networks;

  void (async () => {
    for (const slug of ordered) {
      try {
        const cached = dataPlanCache.get(slug);
        if (
          cached?.complete &&
          cached.expiresAt > Date.now() &&
          cached.variations.length
        ) {
          continue;
        }
        await listDataVariations(slug);
      } catch (error) {
        console.error("[pairgate-data-warm]", slug, error);
      }
    }
  })();
}

export async function listCableVariations(
  providerSlug: string,
): Promise<{ serviceName: string; variations: PairgateVariation[] }> {
  const slug = normalizePairgateTv(providerSlug);
  const serviceName =
    TV_PROVIDERS.find((s) => s.serviceID === slug)?.name || slug.toUpperCase();

  const cacheKey = `cable:${slug}`;
  const cached = dataPlanCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      serviceName: cached.serviceName,
      variations: cached.variations,
    };
  }

  // Live catalog only — /test/cable-plans is empty
  const { ok, status, json } = await pairgateCatalogGet(
    `/cable-plans?provider_id=${encodeURIComponent(slug)}`,
  );
  if (!isPairgateHttpOk(ok, status, json) || !json.data) {
    throw new Error(pairgateErrorMessage(json, "Could not load cable plans"));
  }
  const variations = plansFromGroupedData(json.data as Record<string, unknown>);
  variations.sort(
    (a, b) => (Number(a.charged_amount) || 0) - (Number(b.charged_amount) || 0),
  );

  dataPlanCache.set(cacheKey, {
    expiresAt: Date.now() + DATA_PLAN_CACHE_MS,
    serviceName,
    variations,
    complete: true,
  });

  return { serviceName, variations };
}

export function listElectricityVariations(): {
  serviceName: string;
  variations: PairgateVariation[];
} {
  return {
    serviceName: "Electricity",
    variations: [
      {
        variation_code: "prepaid",
        name: "Prepaid",
        variation_amount: "0",
        fixedPrice: "No",
        charged_amount: 0,
      },
      {
        variation_code: "postpaid",
        name: "Postpaid",
        variation_amount: "0",
        fixedPrice: "No",
        charged_amount: 0,
      },
    ],
  };
}

export async function verifyPairgateCable(input: {
  serviceID: string;
  smartcard: string;
}): Promise<{ ok: boolean; customerName: string | null; message?: string }> {
  const path = pairgateApiPath("/cable/verify", "/test/cable/verify");
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify({
      provider_id: normalizePairgateTv(input.serviceID),
      smartcard: input.smartcard.trim(),
    }),
  });
  const data = json.data || {};
  if (isPairgateSandbox() && data.test_mode) {
    return {
      ok: true,
      customerName: String(data.customer_name || "Test Customer (Sandbox)"),
    };
  }
  if (!isPairgateHttpOk(ok, status, json)) {
    return {
      ok: false,
      customerName: null,
      message: pairgateErrorMessage(json, "Could not verify smartcard"),
    };
  }
  // Pairgate sometimes returns status:true with a blank customer_name.
  const valid = data.status === true || data.status === "true";
  if (!valid) {
    return {
      ok: false,
      customerName: null,
      message: "Invalid smartcard / IUC number",
    };
  }
  const name = String(data.customer_name || "").trim();
  return {
    ok: true,
    customerName: name || "Verified customer",
  };
}

export async function verifyPairgateElectricity(input: {
  serviceID: string;
  meterNumber: string;
  meterType?: string | null;
}): Promise<{ ok: boolean; customerName: string | null; message?: string }> {
  const path = pairgateApiPath("/electricity/verify", "/test/electricity/verify");
  const { ok, status, json } = await pairgateFetch(path, {
    method: "POST",
    body: JSON.stringify({
      provider_id: normalizePairgateDisco(input.serviceID),
      meter_number: input.meterNumber.trim(),
      meter_type: pairgateMeterType(input.meterType),
    }),
  });
  const data = json.data || {};
  if (isPairgateSandbox() && data.test_mode) {
    return {
      ok: true,
      customerName: String(data.customer_name || "Test Customer (Sandbox)"),
    };
  }
  if (!isPairgateHttpOk(ok, status, json)) {
    return {
      ok: false,
      customerName: null,
      message: pairgateErrorMessage(json, "Could not verify meter"),
    };
  }
  const valid = data.status === true || data.status === "true";
  const name = String(data.customer_name || "").trim();
  // Invalid meters often come back as status:false + "Unknown Customer"
  if (!valid) {
    return {
      ok: false,
      customerName: null,
      message: "Invalid meter number for this disco",
    };
  }
  return {
    ok: true,
    customerName: name && name.toLowerCase() !== "unknown customer"
      ? name
      : "Verified customer",
  };
}

export async function lookupPairgateDataPlanAmount(input: {
  serviceID: string;
  planId: string;
  fallbackAmount: number;
}) {
  try {
    const { variations } = await listDataVariations(input.serviceID);
    const match = variations.find((v) => v.variation_code === input.planId);
    const face = Number(match?.charged_amount) || 0;
    if (face > 0) return face;
  } catch {
    // fall through
  }
  return input.fallbackAmount;
}

export async function lookupPairgateCablePlanAmount(input: {
  serviceID: string;
  planId: string;
  fallbackAmount: number;
}) {
  try {
    const { variations } = await listCableVariations(input.serviceID);
    const match = variations.find((v) => v.variation_code === input.planId);
    const face = Number(match?.charged_amount) || 0;
    if (face > 0) return face;
  } catch {
    // fall through
  }
  return input.fallbackAmount;
}
