import type { SupportedCountryCode } from "@/lib/country";

export type DetectedCountryPayload = {
  countryCode: SupportedCountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
  detectedIso: string | null;
  source: string;
  lat?: number;
  lng?: number;
};

/**
 * Detect country via Google IP geolocation (server).
 * Avoids browser Geolocation API — Safari often logs
 * CoreLocation kCLErrorLocationUnknown even when permission is granted.
 */
export async function detectUserCountry(): Promise<DetectedCountryPayload | null> {
  try {
    const res = await fetch("/api/geo/country", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DetectedCountryPayload;
  } catch {
    return null;
  }
}
