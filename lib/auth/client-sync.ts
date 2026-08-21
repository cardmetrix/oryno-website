import { detectUserCountry } from "@/lib/geo/client-detect";
import { getCountryInfo } from "@/lib/country";

const LOGIN_ANNOUNCED_KEY = "oryno_login_announced";

export function markLoginAnnounced() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(LOGIN_ANNOUNCED_KEY, "1");
}

export function clearLoginAnnounced() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(LOGIN_ANNOUNCED_KEY);
}

export function wasLoginAnnounced() {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(LOGIN_ANNOUNCED_KEY) === "1";
}

export async function syncSessionToDatabase(options?: {
  /** Fire login notification + email (login / first session after OAuth). */
  announceLogin?: boolean;
  referralCode?: string | null;
}): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  countryCode?: string;
  currency?: string;
  countryName?: string;
  twoFactorRequired?: boolean;
}> {
  let countryCode: string | undefined;

  try {
    const detected = await detectUserCountry();
    if (detected?.countryCode) {
      countryCode = detected.countryCode;
    }
  } catch {
    // server will fall back to Google IP geolocation
  }

  const announceLogin = options?.announceLogin === true;

  let referralCode = options?.referralCode || null;
  if (!referralCode && typeof window !== "undefined") {
    try {
      const { readStoredReferralCode } = await import("@/lib/referrals/client");
      referralCode = readStoredReferralCode();
    } catch {
      // ignore
    }
  }

  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode,
      forceCountry: Boolean(countryCode),
      announceLogin,
      referralCode: referralCode || undefined,
    }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    return {
      ok: false,
      error: body.error ?? "Failed to sync account",
      code: body.code,
    };
  }

  const json = (await res.json()) as {
    country?: { code?: string; currency?: string; name?: string };
    twoFactorRequired?: boolean;
  };

  const resolvedCode = json.country?.code ?? countryCode;
  const info = resolvedCode ? getCountryInfo(resolvedCode) : null;

  if (typeof window !== "undefined" && info) {
    window.localStorage.setItem(
      "oryno_country",
      JSON.stringify({
        countryCode: info.code,
        currency: info.currency,
        updatedAt: Date.now(),
      }),
    );
  }

  if (announceLogin) {
    markLoginAnnounced();
  }

  if (referralCode && typeof window !== "undefined") {
    try {
      const { clearStoredReferralCode } = await import("@/lib/referrals/client");
      clearStoredReferralCode();
    } catch {
      // ignore
    }
  }

  return {
    ok: true,
    countryCode: info?.code,
    currency: info?.currency ?? json.country?.currency,
    countryName: info?.name ?? json.country?.name,
    twoFactorRequired: Boolean(json.twoFactorRequired),
  };
}
