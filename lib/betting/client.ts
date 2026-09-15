import { resolveCountryCode, type SupportedCountryCode } from "@/lib/country";
import {
  DEMO_BETTING_CUSTOMERS,
  findBettingProvider,
  normalizeBettingCustomerId,
} from "./catalog";
import {
  clubKonnectFund,
  clubKonnectVerify,
  hasClubKonnectKeys,
} from "./clubkonnect";
import { hasVtuAfricaKeys, vtuAfricaFund, vtuAfricaVerify } from "./vtu-africa";

export type BettingRail = "clubkonnect" | "vtu-africa";

/** Nigeria → ClubKonnect; GH / KE / ZA → VTU Africa. */
export function bettingRailForCountry(
  countryCode?: string | null,
): BettingRail {
  return resolveCountryCode(countryCode) === "NG" ? "clubkonnect" : "vtu-africa";
}

export function hasBettingKeys(countryCode?: string | null) {
  const rail = bettingRailForCountry(countryCode);
  return rail === "clubkonnect" ? hasClubKonnectKeys() : hasVtuAfricaKeys();
}

/** @deprecated Prefer hasBettingKeys(country). Kept for callers that only check NG. */
export function bettingApiKey() {
  return (
    process.env.CLUBKONNECT_API_KEY ||
    process.env.VTU_AFRICA_API_KEY ||
    process.env.BETTING_API_KEY ||
    ""
  ).trim();
}

export function isBettingDemoForced() {
  const flag = (
    process.env.BETTING_DEMO ||
    process.env.VTU_AFRICA_DEMO ||
    process.env.CLUBKONNECT_DEMO ||
    ""
  )
    .trim()
    .toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

/** Live when the country’s rail has keys and demo is not forced. */
export function isBettingLiveCountry(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  return (
    (["NG", "GH", "KE", "ZA"] as SupportedCountryCode[]).includes(code) &&
    hasBettingKeys(code)
  );
}

/** Demo when keys are missing for that country’s rail, or BETTING_DEMO is set. */
export function isBettingDemoMode(countryCode?: string | null) {
  return isBettingDemoForced() || !hasBettingKeys(countryCode);
}

function demoCustomer(customerId: string) {
  return DEMO_BETTING_CUSTOMERS.find((c) => c.customerId === customerId);
}

export function demoVerifyName(customerId: string): {
  ok: boolean;
  name: string | null;
  message?: string;
} {
  const known = demoCustomer(customerId);
  if (known) {
    if (known.outcome === "verify_fail") {
      return { ok: false, name: null, message: "Invalid betting account ID" };
    }
    return { ok: true, name: known.name };
  }
  if (!/^\d{6,20}$/.test(customerId)) {
    return { ok: false, name: null, message: "Enter a valid betting account ID" };
  }
  return { ok: true, name: "ORYNO Demo Customer" };
}

export function shouldDemoFundFail(customerId: string) {
  return demoCustomer(customerId)?.outcome === "fund_fail";
}

export async function verifyBettingCustomer(input: {
  serviceID: string;
  customerId: string;
  countryCode?: string | null;
}): Promise<{
  ok: boolean;
  demo: boolean;
  customerName: string | null;
  message?: string;
  rail?: BettingRail;
}> {
  const provider = findBettingProvider(input.serviceID, input.countryCode);
  const rail = bettingRailForCountry(input.countryCode);
  if (!provider) {
    return {
      ok: false,
      demo: isBettingDemoMode(input.countryCode),
      customerName: null,
      message: "Unknown betting provider",
      rail,
    };
  }
  const customerId = normalizeBettingCustomerId(input.customerId);

  if (isBettingDemoMode(input.countryCode)) {
    const demo = demoVerifyName(customerId);
    return {
      ok: demo.ok,
      demo: true,
      customerName: demo.name,
      message: demo.message,
      rail,
    };
  }

  if (rail === "clubkonnect") {
    const result = await clubKonnectVerify({
      serviceID: provider.serviceID,
      customerId,
    });
    return { ...result, demo: false, rail };
  }

  const result = await vtuAfricaVerify({
    serviceID: provider.serviceID,
    customerId,
  });
  return { ...result, demo: false, rail };
}

export async function fundBettingAccount(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  phone?: string | null;
  countryCode?: string | null;
}): Promise<{
  ok: boolean;
  demo: boolean;
  reference: string;
  message?: string;
  rail?: BettingRail;
}> {
  const provider = findBettingProvider(input.serviceID, input.countryCode);
  const rail = bettingRailForCountry(input.countryCode);
  if (!provider) {
    return {
      ok: false,
      demo: isBettingDemoMode(input.countryCode),
      reference: input.reference,
      message: "Unknown betting provider",
      rail,
    };
  }
  const customerId = normalizeBettingCustomerId(input.customerId);

  if (isBettingDemoMode(input.countryCode)) {
    if (shouldDemoFundFail(customerId)) {
      return {
        ok: false,
        demo: true,
        reference: input.reference,
        message: "Demo funding failed",
        rail,
      };
    }
    return {
      ok: true,
      demo: true,
      reference: `DEMO-${input.reference}`,
      message: "Demo betting wallet funded",
      rail,
    };
  }

  if (rail === "clubkonnect") {
    const funded = await clubKonnectFund({
      serviceID: provider.serviceID,
      customerId,
      amount: input.amount,
      reference: input.reference,
      phone: input.phone,
    });
    return { ...funded, demo: false, rail };
  }

  const funded = await vtuAfricaFund({
    serviceID: provider.serviceID,
    customerId,
    amount: input.amount,
    reference: input.reference,
    phone: input.phone,
  });
  return { ...funded, demo: false, rail };
}
