import { openLogoPrimary } from "@/lib/brand-logos";
import { identifierToCategory } from "./catalog";
import type {
  KenyaBillCategory,
  KenyaBillPlan,
  KenyaBillService,
  ReloadlyUtilityBiller,
} from "./types";

function logo(domain: string) {
  return openLogoPrimary(domain);
}

export const ZA_BILL_SERVICES: KenyaBillService[] = [
  {
    serviceID: "dstv-za",
    name: "DStv South Africa",
    category: "tv",
    domain: "dstv.com",
    image: logo("dstv.com"),
    customerLabel: "Smartcard / IUC",
    minAmount: 20,
    maxAmount: 20_000,
    popular: true,
    match: ["dstv"],
  },
  {
    serviceID: "gotv-za",
    name: "GOtv South Africa",
    category: "tv",
    domain: "gotv.com",
    image: logo("gotv.com"),
    customerLabel: "IUC number",
    minAmount: 20,
    maxAmount: 10_000,
    popular: true,
    match: ["gotv"],
  },
  {
    serviceID: "startimes-za",
    name: "StarTimes South Africa",
    category: "tv",
    domain: "startimes.com",
    image: logo("startimes.com"),
    customerLabel: "Smartcard number",
    minAmount: 20,
    maxAmount: 10_000,
    match: ["startimes", "star times"],
  },
  {
    serviceID: "eskom",
    name: "Eskom",
    category: "electricity",
    domain: "eskom.co.za",
    image: logo("eskom.co.za"),
    customerLabel: "Meter number",
    minAmount: 10,
    maxAmount: 50_000,
    popular: true,
    match: ["eskom"],
  },
  {
    serviceID: "city-power",
    name: "City Power",
    category: "electricity",
    domain: "citypower.co.za",
    image: logo("citypower.co.za"),
    customerLabel: "Meter / account number",
    minAmount: 10,
    maxAmount: 50_000,
    match: ["city power", "citypower"],
  },
  {
    serviceID: "johannesburg-water",
    name: "Johannesburg Water",
    category: "water",
    domain: "johannesburgwater.co.za",
    image: logo("johannesburgwater.co.za"),
    customerLabel: "Account number",
    minAmount: 20,
    maxAmount: 20_000,
    popular: true,
    match: ["johannesburg water", "joburg water"],
  },
];

export const ZA_BILL_PRESETS = ["50", "100", "200", "500", "1000"];

function envBillerId(key: string) {
  const n = Number((process.env[key] || "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function zaBillerIds() {
  return {
    dstv: envBillerId("RELOADLY_BILLER_DSTV_ZA"),
    gotv: envBillerId("RELOADLY_BILLER_GOTV_ZA"),
    startimes: envBillerId("RELOADLY_BILLER_STARTIMES_ZA"),
    eskomPrepaid: envBillerId("RELOADLY_BILLER_ESKOM_PREPAID"),
    eskomPostpaid: envBillerId("RELOADLY_BILLER_ESKOM_POSTPAID"),
    cityPowerPrepaid: envBillerId("RELOADLY_BILLER_CITY_POWER_PREPAID"),
    cityPowerPostpaid: envBillerId("RELOADLY_BILLER_CITY_POWER_POSTPAID"),
    johannesburgWater: envBillerId("RELOADLY_BILLER_JHB_WATER"),
  };
}

export function listZaBillServices(identifier: string): KenyaBillService[] {
  const category = identifierToCategory(identifier);
  if (!category) return [];
  return ZA_BILL_SERVICES.filter((s) => s.category === category);
}

export function findZaBillService(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return ZA_BILL_SERVICES.find((s) => s.serviceID === key) ?? null;
}

export function matchZaService(
  biller: ReloadlyUtilityBiller,
): KenyaBillService | null {
  const name = (biller.name || "").toLowerCase();
  return (
    ZA_BILL_SERVICES.find((s) =>
      s.match.some((token) => name.includes(token)),
    ) ?? null
  );
}

export function listZaVariations(
  serviceID: string,
  billers: ReloadlyUtilityBiller[] = [],
): { serviceName: string; variations: KenyaBillPlan[] } {
  const service = findZaBillService(serviceID);
  if (!service) return { serviceName: serviceID, variations: [] };

  const ids = zaBillerIds();
  const related = billers.filter(
    (b) => matchZaService(b)?.serviceID === service.serviceID,
  );

  if (service.category === "electricity") {
    const prepaidEnv =
      service.serviceID === "city-power"
        ? ids.cityPowerPrepaid
        : ids.eskomPrepaid;
    const postpaidEnv =
      service.serviceID === "city-power"
        ? ids.cityPowerPostpaid
        : ids.eskomPostpaid;
    const prepaid =
      related.find((b) => /pre/i.test(`${b.serviceType} ${b.name}`))?.id ??
      prepaidEnv;
    const postpaid =
      related.find((b) => /post/i.test(`${b.serviceType} ${b.name}`))?.id ??
      postpaidEnv;
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
    service.serviceID === "dstv-za"
      ? ids.dstv
      : service.serviceID === "gotv-za"
        ? ids.gotv
        : service.serviceID === "startimes-za"
          ? ids.startimes
          : ids.johannesburgWater;

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

export function resolveZaBillerId(
  serviceID: string,
  variationCode?: string | null,
  billers: ReloadlyUtilityBiller[] = [],
) {
  const plans = listZaVariations(serviceID, billers).variations;
  const plan =
    plans.find((p) => p.variationCode === variationCode) ?? plans[0];
  return plan?.billerId ?? null;
}

export type { KenyaBillCategory as ZaBillCategory };
