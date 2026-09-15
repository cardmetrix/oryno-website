import { resolveCountryCode, type SupportedCountryCode } from "@/lib/country";
import {
  DEMO_BETTING_CUSTOMERS,
  findBettingProvider,
  normalizeBettingCustomerId,
} from "./catalog";
import { hasPairgateKeys, pairgateFund, pairgateVerify } from "./pairgate";
import { hasVtuAfricaKeys, vtuAfricaFund, vtuAfricaVerify } from "./vtu-africa";

export type BettingRail = "pairgate" | "vtu-africa";

/** Nigeria → Pairgate; GH / KE / ZA → VTU Africa. */
export function bettingRailForCountry(
  countryCode?: string | null,
): BettingRail {
  return resolveCountryCode(countryCode) === "NG" ? "pairgate" : "vtu-africa";
}

export function hasBettingKeys(countryCode?: string | null) {
  const rail = bettingRailForCountry(countryCode);
  return rail === "pairgate" ? hasPairgateKeys() : hasVtuAfricaKeys();
}

/** @deprecated Prefer hasBettingKeys(country). */
export function bettingApiKey() {
  return (
    process.env.PAIRGATE_API_KEY ||
    process.env.VTU_AFRICA_API_KEY ||
    process.env.BETTING_API_KEY ||
    ""
  )
    .split("#")[0]
    .trim();
}

export function isBettingDemoForced() {
  const flag = (
    process.env.BETTING_DEMO ||
    process.env.VTU_AFRICA_DEMO ||
    process.env.PAIRGATE_DEMO ||
    ""
  )
    .trim()
    .toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function isBettingLiveCountry(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  return (
    (["NG", "GH", "KE", "ZA"] as SupportedCountryCode[]).includes(code) &&
    hasBettingKeys(code)
  );
}

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

  if (rail === "pairgate") {
    const result = await pairgateVerify({
      serviceID: provider.serviceID,
      customerId,
    });
    return { ...result, demo: false, rail: "pairgate" };
  }

  const result = await vtuAfricaVerify({
    serviceID: provider.serviceID,
    customerId,
  });
  return { ...result, demo: false, rail: "vtu-africa" };
}

export async function fundBettingAccount(input: {
  serviceID: string;
  customerId: string;
  amount: number;
  reference: string;
  phone?: string | null;
  recipientName?: string | null;
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

  if (rail === "pairgate") {
    const funded = await pairgateFund({
      serviceID: provider.serviceID,
      customerId,
      amount: input.amount,
      reference: input.reference,
      recipientName: input.recipientName,
    });
    return { ...funded, demo: false, rail: "pairgate" };
  }

  const funded = await vtuAfricaFund({
    serviceID: provider.serviceID,
    customerId,
    amount: input.amount,
    reference: input.reference,
    phone: input.phone,
  });
  return { ...funded, demo: false, rail: "vtu-africa" };
}
