/** Referral program constants (amounts in NGN mid-market). */
export const REFERRAL_BONUS_NGN = 2_000;
export const REFERRAL_MIN_TRANSACTIONS = 5;
export const REFERRAL_STORAGE_KEY = "oryno_referral_code";
export const REFERRAL_QUERY_PARAM = "ref";

/** Base URL used in share links (website). */
export function referralSignupUrl(code: string, origin?: string) {
  const base =
    origin ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://orynoafrica.com";
  return `${base}/register?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(code)}`;
}

export function normalizeReferralCode(raw: string | null | undefined) {
  return (raw || "").trim().toUpperCase().replace(/\s+/g, "");
}
