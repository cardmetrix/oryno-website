import { eq } from "drizzle-orm";
import { DEFAULT_COUNTRY_SERVICES } from "@/lib/admin/countries";
import { resolveCountryCode } from "@/lib/country";
import { db } from "@/lib/db";
import { countries } from "@/lib/db/schema";

/** Map directory item ids → admin `enabledServices` keys. */
const DIRECTORY_TO_FLAG: Record<string, string> = {
  airtime: "airtime",
  data: "data",
  bills: "bills",
  electricity: "bills",
  betting: "betting",
  "gift-cards": "gift_cards",
  "gift-cards-live": "gift_cards",
  "virtual-numbers": "virtual_numbers",
  social: "social",
  "international-airtime": "airtime",
  invoices: "invoices",
};

export async function getEnabledServiceFlags(
  countryCode?: string | null,
): Promise<string[]> {
  const code = resolveCountryCode(countryCode);
  try {
    const row = await db.query.countries.findFirst({
      where: eq(countries.code, code),
      columns: { enabledServices: true, giftCardsEnabled: true },
    });
    const list = Array.isArray(row?.enabledServices)
      ? row!.enabledServices!.map((s) => String(s))
      : [...DEFAULT_COUNTRY_SERVICES];
    if (row?.giftCardsEnabled === false) {
      return list.filter((s) => s !== "gift_cards");
    }
    return list.length ? list : [...DEFAULT_COUNTRY_SERVICES];
  } catch {
    return [...DEFAULT_COUNTRY_SERVICES];
  }
}

export function isServiceEnabledForFlags(
  serviceId: string,
  flags: string[],
): boolean {
  const flag = DIRECTORY_TO_FLAG[serviceId];
  if (!flag) return true;
  return flags.includes(flag);
}
