import { openLogoPrimary } from "@/lib/brand-logos";

export const KE_DATA_OPERATORS = [
  {
    operator_id: "ke-safaricom",
    name: "Safaricom",
    operator_image: openLogoPrimary("safaricom.co.ke"),
    domain: "safaricom.co.ke",
  },
  {
    operator_id: "ke-airtel",
    name: "Airtel",
    operator_image: openLogoPrimary("airtel.in"),
    domain: "airtel.co.ke",
  },
  {
    operator_id: "ke-telkom",
    name: "Telkom",
    operator_image: openLogoPrimary("telkom.co.ke"),
    domain: "telkom.co.ke",
  },
] as const;

/** Face amounts in KES — convert to NGN before wallet debit / display via FX. */
export const KE_DATA_PLANS: Record<
  string,
  { variation_code: string; name: string; kes: number; fixedPrice: "Yes" }[]
> = {
  "ke-safaricom": [
    { variation_code: "ke-safaricom-daily-50mb", name: "50MB Daily", kes: 20, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-daily-350mb", name: "350MB Daily", kes: 50, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-daily-1gb", name: "1GB Daily", kes: 99, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-weekly-1-25gb", name: "1.25GB Weekly", kes: 120, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-weekly-2gb", name: "2GB Weekly", kes: 150, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-weekly-2-5gb", name: "2.5GB Weekly", kes: 250, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-monthly-5gb", name: "5GB Monthly", kes: 500, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-monthly-10gb", name: "10GB Monthly", kes: 1000, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-monthly-20gb", name: "20GB Monthly", kes: 2000, fixedPrice: "Yes" },
    { variation_code: "ke-safaricom-monthly-30gb", name: "30GB Monthly", kes: 3000, fixedPrice: "Yes" },
  ],
  "ke-airtel": [
    { variation_code: "ke-airtel-daily-50mb", name: "50MB Daily", kes: 20, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-daily-350mb", name: "350MB Daily", kes: 50, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-daily-1gb", name: "1GB Daily", kes: 99, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-weekly-1gb", name: "1GB Weekly", kes: 100, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-weekly-2gb", name: "2GB Weekly", kes: 150, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-monthly-5gb", name: "5GB Monthly", kes: 450, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-monthly-10gb", name: "10GB Monthly", kes: 900, fixedPrice: "Yes" },
    { variation_code: "ke-airtel-monthly-15gb", name: "15GB Monthly", kes: 1500, fixedPrice: "Yes" },
  ],
  "ke-telkom": [
    { variation_code: "ke-telkom-daily-100mb", name: "100MB Daily", kes: 25, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-daily-500mb", name: "500MB Daily", kes: 55, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-daily-1gb", name: "1GB Daily", kes: 99, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-weekly-1-5gb", name: "1.5GB Weekly", kes: 120, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-weekly-3gb", name: "3GB Weekly", kes: 200, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-monthly-4gb", name: "4GB Monthly", kes: 400, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-monthly-8gb", name: "8GB Monthly", kes: 800, fixedPrice: "Yes" },
    { variation_code: "ke-telkom-monthly-15gb", name: "15GB Monthly", kes: 1500, fixedPrice: "Yes" },
  ],
};

export function isKeDataOperator(operatorId?: string | null) {
  const id = (operatorId || "").trim().toLowerCase();
  return id.startsWith("ke-") && id in KE_DATA_PLANS;
}

export function keDataPlansFor(operatorId: string) {
  return KE_DATA_PLANS[operatorId.trim().toLowerCase()] ?? [];
}

export function findKeDataPlan(variationCode: string) {
  const key = variationCode.trim().toLowerCase();
  for (const plans of Object.values(KE_DATA_PLANS)) {
    const match = plans.find((p) => p.variation_code === key);
    if (match) return match;
  }
  return null;
}

export function keDataOperatorName(operatorId?: string | null) {
  const id = (operatorId || "").trim().toLowerCase();
  return KE_DATA_OPERATORS.find((o) => o.operator_id === id)?.name ?? null;
}
