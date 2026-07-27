import type { VtpassService, VtpassVariation } from "./types";

const IMG = "https://sandbox.vtpass.com/resources/products/200X200";
/** Live CDN — some product logos exist only here (sandbox 404s). */
const IMG_LIVE = "https://vtpass.com/resources/products/200X200";

/** Fallback catalogs when VTpass keys are missing (logos still from VTpass CDN). */
export const FALLBACK_AIRTIME_SERVICES: VtpassService[] = [
  {
    serviceID: "mtn",
    name: "MTN Airtime VTU",
    minimium_amount: "50",
    maximum_amount: "50000",
    image: `${IMG}/MTN-Airtime.jpg`,
  },
  {
    serviceID: "airtel",
    name: "Airtel Airtime VTU",
    minimium_amount: "50",
    maximum_amount: "50000",
    image: `${IMG}/Airtel-Airtime.jpg`,
  },
  {
    serviceID: "glo",
    name: "GLO Airtime VTU",
    minimium_amount: "50",
    maximum_amount: "50000",
    image: `${IMG}/GLO-Airtime.jpg`,
  },
  {
    serviceID: "etisalat",
    name: "9mobile Airtime VTU",
    minimium_amount: "50",
    maximum_amount: "50000",
    image: `${IMG}/9mobile-Airtime.jpg`,
  },
];

export const FALLBACK_DATA_SERVICES: VtpassService[] = [
  {
    serviceID: "mtn-data",
    name: "MTN Data",
    image: `${IMG}/MTN-Data.jpg`,
  },
  {
    serviceID: "airtel-data",
    name: "Airtel Data",
    image: `${IMG}/Airtel-Data.jpg`,
  },
  {
    serviceID: "glo-data",
    name: "GLO Data",
    image: `${IMG}/GLO-Data.jpg`,
  },
  {
    serviceID: "etisalat-data",
    name: "9mobile Data",
    image: `${IMG}/9mobile-Data.jpg`,
  },
  {
    serviceID: "smile-direct",
    name: "Smile Payment",
    image: `${IMG}/Smile-Payment.jpg`,
  },
  {
    serviceID: "glo-sme-data",
    name: "GLO Data (SME)",
    // Live CDN — sandbox returns 404 for this asset
    image: `${IMG_LIVE}/GLO-Data-(SME).jpg`,
  },
  {
    serviceID: "spectranet",
    name: "Spectranet Internet Data",
    // Live CDN — sandbox returns 404 for this asset
    image: `${IMG_LIVE}/Spectranet.jpg`,
  },
];

export const FALLBACK_TV_SERVICES: VtpassService[] = [
  {
    serviceID: "dstv",
    name: "DSTV Subscription",
    image: `${IMG}/DStv.jpg`,
  },
  {
    serviceID: "gotv",
    name: "GOTV Payment",
    image: `${IMG}/GOtv.jpg`,
  },
  {
    serviceID: "startimes",
    name: "Startimes Subscription",
    image: `${IMG}/Startimes.jpg`,
  },
  {
    serviceID: "showmax",
    name: "Showmax",
    image: `${IMG}/Showmax.jpg`,
  },
];

export const FALLBACK_ELECTRICITY_SERVICES: VtpassService[] = [
  {
    serviceID: "ikeja-electric",
    name: "Ikeja Electric Payment - IKEDC",
    image: `${IMG}/Ikeja-Electric-Payment---IKEDC.jpg`,
  },
  {
    serviceID: "eko-electric",
    name: "Eko Electric Payment - EKEDC",
    image: `${IMG}/Eko-Electric-Payment---EKEDC.jpg`,
  },
  {
    serviceID: "abuja-electric",
    name: "Abuja Electricity Distribution Company - AEDC",
    image: `${IMG}/AEDC.jpg`,
  },
  {
    serviceID: "kano-electric",
    name: "KEDCO - Kano Electric",
    image: `${IMG}/KEDCO---Kano-Electric.jpg`,
  },
  {
    serviceID: "portharcourt-electric",
    name: "PHED - Port Harcourt Electric",
    image: `${IMG}/PHED---Port-Harcourt-Electric.jpg`,
  },
  {
    serviceID: "jos-electric",
    name: "Jos Electric - JED",
    image: `${IMG}/Jos-Electric---JED.jpg`,
  },
  {
    serviceID: "kaduna-electric",
    name: "Kaduna Electric - KAEDCO",
    image: `${IMG}/Kaduna-Electric---KAEDCO.jpg`,
  },
  {
    serviceID: "enugu-electric",
    name: "Enugu Electric - EEDC",
    image: `${IMG}/Enugu-Electric---EEDC.jpg`,
  },
  {
    serviceID: "ibadan-electric",
    name: "IBEDC - Ibadan Electricity",
    image: `${IMG}/IBEDC.jpg`,
  },
  {
    serviceID: "benin-electric",
    name: "Benin Electricity - BEDC",
    image: `${IMG}/BEDC.jpg`,
  },
  {
    serviceID: "aba-electric",
    name: "Aba Electric Payment - APLE",
    image: `${IMG}/Aba-Electric.jpg`,
  },
  {
    serviceID: "yola-electric",
    name: "Yola Electric Disco Payment - YEDC",
    image: `${IMG}/YEDC.jpg`,
  },
];

export const FALLBACK_ELECTRICITY_VARIATIONS: VtpassVariation[] = [
  {
    variation_code: "prepaid",
    name: "Prepaid",
    variation_amount: "0.00",
    fixedPrice: "No",
  },
  {
    variation_code: "postpaid",
    name: "Postpaid",
    variation_amount: "0.00",
    fixedPrice: "No",
  },
];

export const FALLBACK_DATA_VARIATIONS: Record<string, VtpassVariation[]> = {
  "mtn-data": [
    {
      variation_code: "mtn-10hrs-1000",
      name: "MTN 1GB — 1 day",
      variation_amount: "500.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "mtn-2days-2000",
      name: "MTN 2GB — 2 days",
      variation_amount: "1000.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "mtn-7days-3500",
      name: "MTN 6GB — 7 days",
      variation_amount: "2500.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "mtn-30days-11000",
      name: "MTN 40GB — 30 days",
      variation_amount: "11000.00",
      fixedPrice: "Yes",
    },
  ],
  "airtel-data": [
    {
      variation_code: "airtel-daily-1gb",
      name: "Airtel 1GB — 1 day",
      variation_amount: "400.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "airtel-weekly-5gb",
      name: "Airtel 5GB — 7 days",
      variation_amount: "2000.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "airtel-monthly-35gb",
      name: "Airtel 35GB — 30 days",
      variation_amount: "10000.00",
      fixedPrice: "Yes",
    },
  ],
  "glo-data": [
    {
      variation_code: "glo-daily-2.5gb",
      name: "Glo 2.5GB — 1 day",
      variation_amount: "500.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "glo-weekly-7.5gb",
      name: "Glo 7.5GB — 7 days",
      variation_amount: "2000.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "glo-monthly-50gb",
      name: "Glo 50GB — 30 days",
      variation_amount: "10000.00",
      fixedPrice: "Yes",
    },
  ],
  "etisalat-data": [
    {
      variation_code: "9mobile-daily-1gb",
      name: "9mobile 1GB — 1 day",
      variation_amount: "400.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "9mobile-weekly-4.5gb",
      name: "9mobile 4.5GB — 7 days",
      variation_amount: "2000.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "9mobile-monthly-30gb",
      name: "9mobile 30GB — 30 days",
      variation_amount: "9500.00",
      fixedPrice: "Yes",
    },
  ],
  "glo-sme-data": [
    {
      variation_code: "glo-sme-1gb",
      name: "Glo SME 1GB",
      variation_amount: "300.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "glo-sme-5gb",
      name: "Glo SME 5GB",
      variation_amount: "1200.00",
      fixedPrice: "Yes",
    },
  ],
  "smile-direct": [
    {
      variation_code: "smile-1gb",
      name: "Smile 1GB Flexi",
      variation_amount: "1000.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "smile-5gb",
      name: "Smile 5GB Flexi",
      variation_amount: "4000.00",
      fixedPrice: "Yes",
    },
  ],
  spectranet: [
    {
      variation_code: "spectranet-1gb",
      name: "Spectranet 1GB",
      variation_amount: "1000.00",
      fixedPrice: "Yes",
    },
  ],
};

export const FALLBACK_TV_VARIATIONS: Record<string, VtpassVariation[]> = {
  dstv: [
    {
      variation_code: "dstv-padi",
      name: "DStv Padi",
      variation_amount: "1850.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "dstv-yanga",
      name: "DStv Yanga",
      variation_amount: "2565.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "dstv-confam",
      name: "DStv Confam",
      variation_amount: "4615.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "dstv79",
      name: "DStv Compact",
      variation_amount: "7900.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "dstv3",
      name: "DStv Premium",
      variation_amount: "18400.00",
      fixedPrice: "Yes",
    },
  ],
  gotv: [
    {
      variation_code: "gotv-smallie",
      name: "GOtv Smallie",
      variation_amount: "1575.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "gotv-jinja",
      name: "GOtv Jinja",
      variation_amount: "2700.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "gotv-jolli",
      name: "GOtv Jolli",
      variation_amount: "3950.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "gotv-max",
      name: "GOtv Max",
      variation_amount: "5700.00",
      fixedPrice: "Yes",
    },
  ],
  startimes: [
    {
      variation_code: "nova",
      name: "Nova",
      variation_amount: "1700.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "basic",
      name: "Basic",
      variation_amount: "3000.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "smart",
      name: "Smart",
      variation_amount: "3800.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "classic",
      name: "Classic",
      variation_amount: "5500.00",
      fixedPrice: "Yes",
    },
  ],
  showmax: [
    {
      variation_code: "full",
      name: "Showmax Full",
      variation_amount: "2900.00",
      fixedPrice: "Yes",
    },
    {
      variation_code: "mobile",
      name: "Showmax Mobile",
      variation_amount: "1450.00",
      fixedPrice: "Yes",
    },
  ],
};

export function fallbackServicesFor(
  identifier: "airtime" | "data" | "tv-subscription" | "electricity-bill",
) {
  switch (identifier) {
    case "airtime":
      return FALLBACK_AIRTIME_SERVICES;
    case "data":
      return FALLBACK_DATA_SERVICES;
    case "tv-subscription":
      return FALLBACK_TV_SERVICES;
    case "electricity-bill":
      return FALLBACK_ELECTRICITY_SERVICES;
  }
}

export function fallbackVariationsFor(serviceID: string): VtpassVariation[] {
  if (serviceID in FALLBACK_DATA_VARIATIONS) {
    return FALLBACK_DATA_VARIATIONS[serviceID];
  }
  if (serviceID in FALLBACK_TV_VARIATIONS) {
    return FALLBACK_TV_VARIATIONS[serviceID];
  }
  if (
    serviceID.includes("electric") ||
    [
      "ikeja-electric",
      "eko-electric",
      "abuja-electric",
      "kano-electric",
      "portharcourt-electric",
      "jos-electric",
      "kaduna-electric",
      "enugu-electric",
      "ibadan-electric",
      "benin-electric",
      "aba-electric",
      "yola-electric",
    ].includes(serviceID)
  ) {
    return FALLBACK_ELECTRICITY_VARIATIONS;
  }
  return [];
}

export function inferDataPlanCategory(
  name: string,
): "daily" | "weekly" | "monthly" {
  const lower = name.toLowerCase();
  if (
    lower.includes("day") ||
    lower.includes("daily") ||
    lower.includes("24 hour") ||
    /\b1\s*day\b/.test(lower)
  ) {
    return "daily";
  }
  if (
    lower.includes("week") ||
    lower.includes("7 day") ||
    lower.includes("7-day")
  ) {
    return "weekly";
  }
  return "monthly";
}

/** Prefer live VTpass CDN host; repair known broken filenames from their API. */
const SERVICE_IMAGE_OVERRIDES: Record<string, string> = {
  // API returns *-Airtime-VTU.jpg which 404s; working files omit -VTU
  mtn: `${IMG}/MTN-Airtime.jpg`,
  airtel: `${IMG}/Airtel-Airtime.jpg`,
  glo: `${IMG}/GLO-Airtime.jpg`,
  etisalat: `${IMG}/9mobile-Airtime.jpg`,
  "mtn-data": `${IMG}/MTN-Data.jpg`,
  "airtel-data": `${IMG}/Airtel-Data.jpg`,
  "glo-data": `${IMG}/GLO-Data.jpg`,
  "etisalat-data": `${IMG}/9mobile-Data.jpg`,
  "smile-direct": `${IMG}/Smile-Payment.jpg`,
  "glo-sme-data": `${IMG_LIVE}/GLO-Data-(SME).jpg`,
  spectranet: `${IMG_LIVE}/Spectranet.jpg`,
  dstv: `${IMG}/Pay-DSTV-Subscription.jpg`,
  gotv: `${IMG}/Gotv-Payment.jpg`,
  startimes: `${IMG}/Startimes-Subscription.jpg`,
  "ikeja-electric": `${IMG}/Ikeja-Electric-Payment-PHCN.jpg`,
  "eko-electric": `${IMG}/Eko-Electric-Payment-PHCN.jpg`,
  "abuja-electric": `${IMG}/Abuja-Electric.jpg`,
  "kano-electric": `${IMG}/Kano-Electric.jpg`,
  "portharcourt-electric": `${IMG}/Port-Harcourt-Electric.jpg`,
  "jos-electric": `${IMG}/Jos-Electric-JED.jpg`,
  "kaduna-electric": `${IMG}/Kaduna-Electric-KAEDCO.jpg`,
  "enugu-electric": `${IMG}/Enugu-Electric-EEDC.jpg`,
};

/** Strip product words so UI shows only the network / brand name. */
export function cleanNetworkName(name: string) {
  return name
    .replace(/\bAirtime\b/gi, "")
    .replace(/\bVTU\b/gi, "")
    .replace(/\bData\b/gi, "")
    .replace(/\bPayment\b/gi, "")
    .replace(/\bSubscription\b/gi, "")
    .replace(/\bInternet\b/gi, "")
    .replace(/\b\(SME\)\b/gi, "SME")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveServiceImage(
  image?: string | null,
  serviceID?: string | null,
) {
  if (serviceID && SERVICE_IMAGE_OVERRIDES[serviceID]) {
    return SERVICE_IMAGE_OVERRIDES[serviceID];
  }

  if (!image) return null;

  let url = image.startsWith("http")
    ? image
    : `https://sandbox.vtpass.com${image.startsWith("/") ? "" : "/"}${image}`;

  // VTpass often returns Airtime-VTU.jpg which 404s — fall back to Airtime.jpg
  url = url
    .replace(/-Airtime-VTU\.jpg$/i, "-Airtime.jpg")
    .replace(/-VTU\.jpg$/i, ".jpg");

  // Some assets (GLO SME, Spectranet, …) are only on the live CDN
  if (
    /GLO-Data-\(SME\)|Spectranet/i.test(url) &&
    url.includes("sandbox.vtpass.com")
  ) {
    url = url.replace(
      "https://sandbox.vtpass.com",
      "https://vtpass.com",
    );
  }

  return url;
}
