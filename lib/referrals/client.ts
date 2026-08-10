/** Client helpers for capturing referral codes from links. */

import {
  normalizeReferralCode,
  REFERRAL_QUERY_PARAM,
  REFERRAL_STORAGE_KEY,
} from "@/lib/referrals/config";

export function persistReferralCode(raw: string | null | undefined) {
  if (typeof window === "undefined") return;
  const code = normalizeReferralCode(raw);
  if (!code) return;
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

export function readStoredReferralCode() {
  if (typeof window === "undefined") return null;
  try {
    return normalizeReferralCode(
      window.localStorage.getItem(REFERRAL_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

export function clearStoredReferralCode() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Capture `?ref=` on any page load. */
export function captureReferralFromSearch(
  searchParams: URLSearchParams | { get: (k: string) => string | null },
) {
  const code = searchParams.get(REFERRAL_QUERY_PARAM);
  if (code) persistReferralCode(code);
  return normalizeReferralCode(code);
}
