import { openLogoPrimary } from "@/lib/brand-logos";

/** Same SA networks as data — shared operator IDs so product_type_id picks airtime vs data packs. */
export const ZA_AIRTIME_OPERATORS = [
  {
    operator_id: "za-mtn",
    name: "MTN",
    operator_image: openLogoPrimary("mtn.co.za"),
    domain: "mtn.co.za",
  },
  {
    operator_id: "za-vodacom",
    name: "Vodacom",
    operator_image: openLogoPrimary("vodacom.co.za"),
    domain: "vodacom.co.za",
  },
  {
    operator_id: "za-cellc",
    name: "Cell C",
    operator_image: openLogoPrimary("cellc.co.za"),
    domain: "cellc.co.za",
  },
  {
    operator_id: "za-telkom",
    name: "Telkom",
    operator_image: openLogoPrimary("telkom.co.za"),
    domain: "telkom.co.za",
  },
] as const;

export type ZaAirtimePack = {
  variation_code: string;
  name: string;
  zar: number;
  fixedPrice: "Yes";
};

/** Face amounts in ZAR — convert to NGN before wallet debit / display via FX. */
const ZA_AIRTIME_PACKS_COMMON: Omit<ZaAirtimePack, "variation_code">[] = [
  { name: "R10 Airtime", zar: 10, fixedPrice: "Yes" },
  { name: "R20 Airtime", zar: 20, fixedPrice: "Yes" },
  { name: "R50 Airtime", zar: 50, fixedPrice: "Yes" },
  { name: "R100 Airtime", zar: 100, fixedPrice: "Yes" },
  { name: "R200 Airtime", zar: 200, fixedPrice: "Yes" },
  { name: "R500 Airtime", zar: 500, fixedPrice: "Yes" },
];

function packsFor(operatorId: string): ZaAirtimePack[] {
  const id = operatorId.trim().toLowerCase();
  return ZA_AIRTIME_PACKS_COMMON.map((p) => ({
    ...p,
    variation_code: `${id}-air-${p.zar}`,
  }));
}

export const ZA_AIRTIME_PACKS: Record<string, ZaAirtimePack[]> = {
  "za-mtn": packsFor("za-mtn"),
  "za-vodacom": packsFor("za-vodacom"),
  "za-cellc": packsFor("za-cellc"),
  "za-telkom": packsFor("za-telkom"),
};

/** VTpass international product_type_id for Mobile Data. */
export function isIntlDataProductType(productTypeId?: string | number | null) {
  return String(productTypeId ?? "").trim() === "4";
}

export function isZaAirtimeOperator(operatorId?: string | null) {
  const id = (operatorId || "").trim().toLowerCase();
  return id.startsWith("za-") && id in ZA_AIRTIME_PACKS;
}

export function zaAirtimePacksFor(operatorId: string) {
  return ZA_AIRTIME_PACKS[operatorId.trim().toLowerCase()] ?? [];
}

export function findZaAirtimePack(variationCode: string) {
  const key = variationCode.trim().toLowerCase();
  for (const packs of Object.values(ZA_AIRTIME_PACKS)) {
    const match = packs.find((p) => p.variation_code === key);
    if (match) return match;
  }
  return null;
}
