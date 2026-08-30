import { openLogoPrimary } from "@/lib/brand-logos";

export const ZA_DATA_OPERATORS = [
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

/** Face amounts in ZAR — convert to NGN before wallet debit / display via FX. */
export const ZA_DATA_PLANS: Record<
  string,
  { variation_code: string; name: string; zar: number; fixedPrice: "Yes" }[]
> = {
  "za-mtn": [
    { variation_code: "za-mtn-daily-100", name: "100MB Daily", zar: 12, fixedPrice: "Yes" },
    { variation_code: "za-mtn-daily-500", name: "500MB Daily", zar: 29, fixedPrice: "Yes" },
    { variation_code: "za-mtn-weekly-1gb", name: "1GB Weekly", zar: 49, fixedPrice: "Yes" },
    { variation_code: "za-mtn-weekly-2gb", name: "2GB Weekly", zar: 85, fixedPrice: "Yes" },
    { variation_code: "za-mtn-monthly-5gb", name: "5GB Monthly", zar: 149, fixedPrice: "Yes" },
    { variation_code: "za-mtn-monthly-10gb", name: "10GB Monthly", zar: 249, fixedPrice: "Yes" },
    { variation_code: "za-mtn-monthly-20gb", name: "20GB Monthly", zar: 399, fixedPrice: "Yes" },
  ],
  "za-vodacom": [
    { variation_code: "za-vodacom-daily-100", name: "100MB Daily", zar: 12, fixedPrice: "Yes" },
    { variation_code: "za-vodacom-weekly-1gb", name: "1GB Weekly", zar: 49, fixedPrice: "Yes" },
    { variation_code: "za-vodacom-monthly-5gb", name: "5GB Monthly", zar: 149, fixedPrice: "Yes" },
    { variation_code: "za-vodacom-monthly-10gb", name: "10GB Monthly", zar: 249, fixedPrice: "Yes" },
    { variation_code: "za-vodacom-monthly-20gb", name: "20GB Monthly", zar: 399, fixedPrice: "Yes" },
  ],
  "za-cellc": [
    { variation_code: "za-cellc-daily-250", name: "250MB Daily", zar: 19, fixedPrice: "Yes" },
    { variation_code: "za-cellc-weekly-1gb", name: "1GB Weekly", zar: 45, fixedPrice: "Yes" },
    { variation_code: "za-cellc-monthly-5gb", name: "5GB Monthly", zar: 129, fixedPrice: "Yes" },
    { variation_code: "za-cellc-monthly-10gb", name: "10GB Monthly", zar: 229, fixedPrice: "Yes" },
  ],
  "za-telkom": [
    { variation_code: "za-telkom-daily-250", name: "250MB Daily", zar: 15, fixedPrice: "Yes" },
    { variation_code: "za-telkom-weekly-1gb", name: "1.5GB Weekly", zar: 39, fixedPrice: "Yes" },
    { variation_code: "za-telkom-monthly-6gb", name: "6GB Monthly", zar: 119, fixedPrice: "Yes" },
    { variation_code: "za-telkom-monthly-11gb", name: "11GB Monthly", zar: 199, fixedPrice: "Yes" },
  ],
};

export function isZaDataOperator(operatorId?: string | null) {
  const id = (operatorId || "").trim().toLowerCase();
  return id.startsWith("za-") && id in ZA_DATA_PLANS;
}

export function zaDataPlansFor(operatorId: string) {
  return ZA_DATA_PLANS[operatorId.trim().toLowerCase()] ?? [];
}

export function findZaDataPlan(variationCode: string) {
  const key = variationCode.trim().toLowerCase();
  for (const plans of Object.values(ZA_DATA_PLANS)) {
    const match = plans.find((p) => p.variation_code === key);
    if (match) return match;
  }
  return null;
}
