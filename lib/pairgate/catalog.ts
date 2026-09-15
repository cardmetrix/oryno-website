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

const DATA_PLAN_TYPES = ["CG", "CG_LITE", "SME", "GIFTING", "AWOOF"] as const;

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
  etisalat: "9mobile",
  "etisalat-data": "9mobile",
  "9mobile": "9mobile",
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
      const label = planType ? `${name} (${planType})` : name;
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

export async function listDataVariations(
  providerSlug: string,
): Promise<{ serviceName: string; variations: PairgateVariation[] }> {
  const slug = normalizePairgateNetwork(providerSlug);
  const serviceName =
    DATA_NETWORKS.find((s) => s.serviceID === slug)?.name || slug.toUpperCase();

  const results = await Promise.all(
    DATA_PLAN_TYPES.map(async (planType) => {
      const path = pairgateApiPath(
        `/data-plans?provider_id=${encodeURIComponent(slug)}&plan_type=${planType}`,
        `/test/data-plans?provider_id=${encodeURIComponent(slug)}&plan_type=${planType}`,
      );
      try {
        const { ok, status, json } = await pairgateFetch(path, { method: "GET" });
        if (!isPairgateHttpOk(ok, status, json) || !json.data) return [];
        return plansFromGroupedData(
          json.data as Record<string, unknown>,
          planType,
        );
      } catch (error) {
        console.error("[pairgate-data-plans]", slug, planType, error);
        return [];
      }
    }),
  );

  const seen = new Set<string>();
  const variations: PairgateVariation[] = [];
  for (const batch of results) {
    for (const v of batch) {
      if (seen.has(v.variation_code)) continue;
      seen.add(v.variation_code);
      variations.push(v);
    }
  }

  variations.sort(
    (a, b) => (Number(a.charged_amount) || 0) - (Number(b.charged_amount) || 0),
  );

  return { serviceName, variations };
}

export async function listCableVariations(
  providerSlug: string,
): Promise<{ serviceName: string; variations: PairgateVariation[] }> {
  const slug = normalizePairgateTv(providerSlug);
  const serviceName =
    TV_PROVIDERS.find((s) => s.serviceID === slug)?.name || slug.toUpperCase();
  const path = pairgateApiPath(
    `/cable-plans?provider_id=${encodeURIComponent(slug)}`,
    `/test/cable-plans?provider_id=${encodeURIComponent(slug)}`,
  );
  const { ok, status, json } = await pairgateFetch(path, { method: "GET" });
  if (!isPairgateHttpOk(ok, status, json) || !json.data) {
    throw new Error(pairgateErrorMessage(json, "Could not load cable plans"));
  }
  const variations = plansFromGroupedData(json.data as Record<string, unknown>);
  variations.sort(
    (a, b) => (Number(a.charged_amount) || 0) - (Number(b.charged_amount) || 0),
  );
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
  const valid = data.status === true || data.status === "true";
  const name = String(data.customer_name || "").trim();
  if (!valid || !name) {
    return {
      ok: false,
      customerName: null,
      message: pairgateErrorMessage(json, "Could not verify smartcard"),
    };
  }
  return { ok: true, customerName: name };
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
  if (!valid || !name) {
    return {
      ok: false,
      customerName: null,
      message: pairgateErrorMessage(json, "Could not verify meter"),
    };
  }
  return { ok: true, customerName: name };
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
