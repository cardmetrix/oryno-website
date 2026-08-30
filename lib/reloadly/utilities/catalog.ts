import { openLogoPrimary } from "@/lib/brand-logos";
import type {
  KenyaBillCategory,
  KenyaBillPlan,
  KenyaBillService,
  ReloadlyUtilityBiller,
} from "./types";

function logo(domain: string) {
  return openLogoPrimary(domain);
}

export const KENYA_BILL_SERVICES: KenyaBillService[] = [
  {
    serviceID: "dstv",
    name: "DStv Kenya",
    category: "tv",
    domain: "dstv.com",
    image: logo("dstv.com"),
    customerLabel: "Smartcard / IUC",
    minAmount: 50,
    maxAmount: 100_000,
    popular: true,
    match: ["dstv"],
  },
  {
    serviceID: "gotv",
    name: "GOtv Kenya",
    category: "tv",
    domain: "gotv.com",
    image: logo("gotv.com"),
    customerLabel: "IUC number",
    minAmount: 50,
    maxAmount: 50_000,
    popular: true,
    match: ["gotv"],
  },
  {
    serviceID: "startimes",
    name: "StarTimes Kenya",
    category: "tv",
    domain: "startimes.com",
    image: logo("startimes.com"),
    customerLabel: "Smartcard number",
    minAmount: 50,
    maxAmount: 50_000,
    match: ["startimes", "star times"],
  },
  {
    serviceID: "zuku",
    name: "Zuku",
    category: "tv",
    domain: "zuku.co.ke",
    image: logo("zuku.co.ke"),
    customerLabel: "Account number",
    minAmount: 100,
    maxAmount: 100_000,
    match: ["zuku"],
  },
  {
    serviceID: "kplc",
    name: "Kenya Power (KPLC)",
    category: "electricity",
    domain: "kplc.co.ke",
    image: logo("kplc.co.ke"),
    customerLabel: "Meter number",
    minAmount: 100,
    maxAmount: 200_000,
    popular: true,
    match: ["kplc", "kenya power", "kenya electricity"],
  },
  {
    serviceID: "nairobi-water",
    name: "Nairobi Water",
    category: "water",
    domain: "nairobiwater.co.ke",
    image: logo("nairobiwater.co.ke"),
    customerLabel: "Account number",
    minAmount: 50,
    maxAmount: 100_000,
    popular: true,
    match: ["nairobi water", "ncwsc"],
  },
];

export const KENYA_BILL_PRESETS = ["200", "500", "1000", "2000", "5000"];

function envBillerId(key: string) {
  const n = Number((process.env[key] || "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function kenyaBillerIds() {
  return {
    dstv: envBillerId("RELOADLY_BILLER_DSTV_KE"),
    gotv: envBillerId("RELOADLY_BILLER_GOTV_KE"),
    startimes: envBillerId("RELOADLY_BILLER_STARTIMES_KE"),
    zuku: envBillerId("RELOADLY_BILLER_ZUKU_KE"),
    kplcPrepaid: envBillerId("RELOADLY_BILLER_KPLC_PREPAID"),
    kplcPostpaid: envBillerId("RELOADLY_BILLER_KPLC_POSTPAID"),
    nairobiWater: envBillerId("RELOADLY_BILLER_NAIROBI_WATER"),
  };
}

export function listKenyaBillServices(identifier: string): KenyaBillService[] {
  const category = identifierToCategory(identifier);
  if (!category) return [];
  return KENYA_BILL_SERVICES.filter((s) => s.category === category);
}

export function findKenyaBillService(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return KENYA_BILL_SERVICES.find((s) => s.serviceID === key) ?? null;
}

export function matchKenyaService(
  biller: ReloadlyUtilityBiller,
): KenyaBillService | null {
  const name = (biller.name || "").toLowerCase();
  return (
    KENYA_BILL_SERVICES.find((s) =>
      s.match.some((token) => name.includes(token)),
    ) ?? null
  );
}

export function listKenyaVariations(
  serviceID: string,
  billers: ReloadlyUtilityBiller[] = [],
): { serviceName: string; variations: KenyaBillPlan[] } {
  const service = findKenyaBillService(serviceID);
  if (!service) return { serviceName: serviceID, variations: [] };

  const ids = kenyaBillerIds();
  const related = billers.filter((b) => matchKenyaService(b)?.serviceID === service.serviceID);

  if (service.category === "electricity") {
    const prepaid =
      related.find((b) => /pre/i.test(`${b.serviceType} ${b.name}`))?.id ??
      ids.kplcPrepaid;
    const postpaid =
      related.find((b) => /post/i.test(`${b.serviceType} ${b.name}`))?.id ??
      ids.kplcPostpaid;
    return {
      serviceName: service.name,
      variations: [
        {
          variationCode: "prepaid",
          name: "Prepaid",
          amount: 0,
          fixedPrice: false,
          billerId: prepaid,
        },
        {
          variationCode: "postpaid",
          name: "Postpaid",
          amount: 0,
          fixedPrice: false,
          billerId: postpaid,
        },
      ],
    };
  }

  const envId =
    service.serviceID === "dstv"
      ? ids.dstv
      : service.serviceID === "gotv"
        ? ids.gotv
        : service.serviceID === "startimes"
          ? ids.startimes
          : service.serviceID === "zuku"
            ? ids.zuku
            : ids.nairobiWater;

  return {
    serviceName: service.name,
    variations: [
      {
        variationCode: service.category === "water" ? "bill" : "renew",
        name:
          service.category === "water"
            ? "Water bill"
            : "Renew / pay any amount",
        amount: 0,
        fixedPrice: false,
        billerId: related[0]?.id ?? envId,
      },
    ],
  };
}

export function resolveKenyaBillerId(
  serviceID: string,
  variationCode?: string | null,
  billers: ReloadlyUtilityBiller[] = [],
) {
  const plans = listKenyaVariations(serviceID, billers).variations;
  const plan =
    plans.find((p) => p.variationCode === variationCode) ?? plans[0];
  return plan?.billerId ?? null;
}

export function identifierToCategory(
  identifier: string,
): KenyaBillCategory | null {
  if (identifier === "tv-subscription") return "tv";
  if (identifier === "electricity-bill") return "electricity";
  if (identifier === "water-bill") return "water";
  return null;
}

export function reloadlyTypeForCategory(category: KenyaBillCategory) {
  if (category === "tv") return "TV_BILL_PAYMENT";
  if (category === "electricity") return "ELECTRICITY_BILL_PAYMENT";
  return "WATER_BILL_PAYMENT";
}
