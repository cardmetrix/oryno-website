import { openLogoPrimary } from "@/lib/brand-logos";
import type { HubtelBillCategory, HubtelBillPlan, HubtelBillService } from "./types";

function logo(domain: string) {
  return openLogoPrimary(domain);
}

/**
 * Official Hubtel Commission Services IDs from the 2020 API guide.
 * Override any of these from the Hubtel dashboard after you subscribe.
 */
const DEFAULT_SERVICE_IDS = {
  dstv: "46ad8b00d5d41b256ea7",
  gotv: "435cb30b048e9617eb41",
  startimes: "",
  ecgPrepaid: "",
  ecgPostpaid: "4c12baa45e2f3bfe433f",
  gwcl: "",
} as const;

function envId(key: string, fallback: string) {
  return (process.env[key] || "").trim() || fallback;
}

export function hubtelServiceIds() {
  return {
    dstv: envId("HUBTEL_SERVICE_DSTV", DEFAULT_SERVICE_IDS.dstv),
    gotv: envId("HUBTEL_SERVICE_GOTV", DEFAULT_SERVICE_IDS.gotv),
    startimes: envId("HUBTEL_SERVICE_STARTIMES", DEFAULT_SERVICE_IDS.startimes),
    ecgPrepaid: envId(
      "HUBTEL_SERVICE_ECG_PREPAID",
      DEFAULT_SERVICE_IDS.ecgPrepaid,
    ),
    ecgPostpaid: envId(
      "HUBTEL_SERVICE_ECG_POSTPAID",
      DEFAULT_SERVICE_IDS.ecgPostpaid,
    ),
    gwcl: envId("HUBTEL_SERVICE_GWCL", DEFAULT_SERVICE_IDS.gwcl),
  };
}

export const GHANA_BILL_SERVICES: HubtelBillService[] = [
  {
    serviceID: "dstv",
    name: "DStv Ghana",
    category: "tv",
    domain: "dstv.com",
    image: logo("dstv.com"),
    customerLabel: "Smartcard / IUC",
    minAmount: 5,
    maxAmount: 5000,
    popular: true,
  },
  {
    serviceID: "gotv",
    name: "GOtv Ghana",
    category: "tv",
    domain: "gotv.com",
    image: logo("gotv.com"),
    customerLabel: "IUC number",
    minAmount: 5,
    maxAmount: 2000,
    popular: true,
  },
  {
    serviceID: "startimes",
    name: "StarTimes Ghana",
    category: "tv",
    domain: "startimes.com",
    image: logo("startimes.com"),
    customerLabel: "Smartcard number",
    minAmount: 5,
    maxAmount: 2000,
  },
  {
    serviceID: "ecg",
    name: "ECG",
    category: "electricity",
    domain: "ecg.com.gh",
    image: logo("ecg.com.gh"),
    customerLabel: "Meter number",
    minAmount: 1,
    maxAmount: 10000,
    popular: true,
  },
  {
    serviceID: "gwcl",
    name: "Ghana Water",
    category: "water",
    domain: "gwcl.com.gh",
    image: logo("gwcl.com.gh"),
    customerLabel: "Account number",
    minAmount: 5,
    maxAmount: 5000,
    popular: true,
  },
];

/** Suggested GHS top-ups (Hubtel bills are amount-based, not locked bouquets). */
export const GHANA_BILL_PRESETS = ["20", "50", "100", "200", "500"];

export function listHubtelBillServices(identifier: string): HubtelBillService[] {
  const category = identifierToCategory(identifier);
  if (!category) return [];
  return GHANA_BILL_SERVICES.filter((s) => s.category === category);
}

export function findHubtelBillService(serviceID: string) {
  const key = serviceID.trim().toLowerCase();
  return GHANA_BILL_SERVICES.find((s) => s.serviceID === key) ?? null;
}

export function listHubtelVariations(serviceID: string): {
  serviceName: string;
  variations: HubtelBillPlan[];
} {
  const service = findHubtelBillService(serviceID);
  if (!service) return { serviceName: serviceID, variations: [] };

  const ids = hubtelServiceIds();

  if (service.category === "electricity") {
    return {
      serviceName: service.name,
      variations: [
        {
          variationCode: "prepaid",
          name: "Prepaid",
          amount: 0,
          fixedPrice: false,
          hubtelServiceId: ids.ecgPrepaid,
        },
        {
          variationCode: "postpaid",
          name: "Postpaid",
          amount: 0,
          fixedPrice: false,
          hubtelServiceId: ids.ecgPostpaid,
        },
      ],
    };
  }

  if (service.category === "water") {
    return {
      serviceName: service.name,
      variations: [
        {
          variationCode: "bill",
          name: "Water bill",
          amount: 0,
          fixedPrice: false,
          hubtelServiceId: ids.gwcl,
        },
      ],
    };
  }

  const tvId =
    service.serviceID === "dstv"
      ? ids.dstv
      : service.serviceID === "gotv"
        ? ids.gotv
        : ids.startimes;

  return {
    serviceName: service.name,
    variations: [
      {
        variationCode: "renew",
        name: "Renew / pay any amount",
        amount: 0,
        fixedPrice: false,
        hubtelServiceId: tvId,
      },
    ],
  };
}

export function resolveHubtelServiceId(
  serviceID: string,
  variationCode?: string | null,
) {
  const ids = hubtelServiceIds();
  const key = serviceID.trim().toLowerCase();
  if (key === "ecg") {
    return variationCode === "postpaid" ? ids.ecgPostpaid : ids.ecgPrepaid;
  }
  if (key === "gwcl") return ids.gwcl;
  if (key === "dstv") return ids.dstv;
  if (key === "gotv") return ids.gotv;
  if (key === "startimes") return ids.startimes;
  return "";
}

export function identifierToCategory(
  identifier: string,
): HubtelBillCategory | null {
  if (identifier === "tv-subscription") return "tv";
  if (identifier === "electricity-bill") return "electricity";
  if (identifier === "water-bill") return "water";
  return null;
}

export function categoryToIdentifier(category: HubtelBillCategory) {
  if (category === "tv") return "tv-subscription";
  if (category === "electricity") return "electricity-bill";
  return "water-bill";
}
