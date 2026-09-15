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
  isClubKonnectAccountMismatch,
} from "./clubkonnect";
import { hasVtuAfricaKeys, vtuAfricaFund, vtuAfricaVerify } from "./vtu-africa";

export type BettingRail = "clubkonnect" | "vtu-africa";

/** Preferred rail: Nigeria → ClubKonnect; GH / KE / ZA → VTU Africa. */
export function bettingRailForCountry(
  countryCode?: string | null,
): BettingRail {
  return resolveCountryCode(countryCode) === "NG" ? "clubkonnect" : "vtu-africa";
}

/**
 * Nigeria is live if ClubKonnect OR VTU Africa keys exist (VTU is fallback when
 * ClubKonnect returns ACCOUNT_MISMATCH / empty verify).
 */
export function hasBettingKeys(countryCode?: string | null) {
  const code = resolveCountryCode(countryCode);
  if (code === "NG") {
    return hasClubKonnectKeys() || hasVtuAfricaKeys();
  }
  return hasVtuAfricaKeys();
}

/** @deprecated Prefer hasBettingKeys(country). */
export function bettingApiKey() {
  return (
    process.env.CLUBKONNECT_API_KEY ||
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
    process.env.CLUBKONNECT_DEMO ||
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
  const preferred = bettingRailForCountry(input.countryCode);
  if (!provider) {
    return {
      ok: false,
      demo: isBettingDemoMode(input.countryCode),
      customerName: null,
      message: "Unknown betting provider",
      rail: preferred,
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
      rail: preferred,
    };
  }

  // Nigeria: ClubKonnect first, VTU Africa fallback when CK account cannot vend.
  if (preferred === "clubkonnect") {
    if (hasClubKonnectKeys()) {
      const ck = await clubKonnectVerify({
        serviceID: provider.serviceID,
        customerId,
      });
      if (ck.ok) return { ...ck, demo: false, rail: "clubkonnect" };

      if (hasVtuAfricaKeys() && isClubKonnectAccountMismatch(ck.message)) {
        const vtu = await vtuAfricaVerify({
          serviceID: provider.serviceID,
          customerId,
        });
        if (vtu.ok) return { ...vtu, demo: false, rail: "vtu-africa" };
        return {
          ok: false,
          demo: false,
          customerName: null,
          message: vtu.message || ck.message,
          rail: "vtu-africa",
        };
      }

      // Soft-fallback: any CK verify miss with VTU available (keeps NG live).
      if (hasVtuAfricaKeys()) {
        const vtu = await vtuAfricaVerify({
          serviceID: provider.serviceID,
          customerId,
        });
        if (vtu.ok) return { ...vtu, demo: false, rail: "vtu-africa" };
        return {
          ok: false,
          demo: false,
          customerName: null,
          message: vtu.message || ck.message,
          rail: "vtu-africa",
        };
      }

      return { ...ck, demo: false, rail: "clubkonnect" };
    }

    if (hasVtuAfricaKeys()) {
      const vtu = await vtuAfricaVerify({
        serviceID: provider.serviceID,
        customerId,
      });
      return { ...vtu, demo: false, rail: "vtu-africa" };
    }
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
  countryCode?: string | null;
}): Promise<{
  ok: boolean;
  demo: boolean;
  reference: string;
  message?: string;
  rail?: BettingRail;
}> {
  const provider = findBettingProvider(input.serviceID, input.countryCode);
  const preferred = bettingRailForCountry(input.countryCode);
  if (!provider) {
    return {
      ok: false,
      demo: isBettingDemoMode(input.countryCode),
      reference: input.reference,
      message: "Unknown betting provider",
      rail: preferred,
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
        rail: preferred,
      };
    }
    return {
      ok: true,
      demo: true,
      reference: `DEMO-${input.reference}`,
      message: "Demo betting wallet funded",
      rail: preferred,
    };
  }

  if (preferred === "clubkonnect") {
    if (hasClubKonnectKeys()) {
      const ck = await clubKonnectFund({
        serviceID: provider.serviceID,
        customerId,
        amount: input.amount,
        reference: input.reference,
        phone: input.phone,
      });
      if (ck.ok) return { ...ck, demo: false, rail: "clubkonnect" };

      if (hasVtuAfricaKeys()) {
        const vtu = await vtuAfricaFund({
          serviceID: provider.serviceID,
          customerId,
          amount: input.amount,
          reference: input.reference,
          phone: input.phone,
        });
        return { ...vtu, demo: false, rail: "vtu-africa" };
      }

      return { ...ck, demo: false, rail: "clubkonnect" };
    }

    if (hasVtuAfricaKeys()) {
      const vtu = await vtuAfricaFund({
        serviceID: provider.serviceID,
        customerId,
        amount: input.amount,
        reference: input.reference,
        phone: input.phone,
      });
      return { ...vtu, demo: false, rail: "vtu-africa" };
    }
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
