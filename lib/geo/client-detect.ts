import type { SupportedCountryCode } from "@/lib/country";

export type DetectedCountryPayload = {
  countryCode: SupportedCountryCode;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string;
  detectedIso: string | null;
  source: string;
};

function getBrowserCoords(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), 4500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: false, maximumAge: 600_000, timeout: 4000 },
    );
  });
}

/** Detect country on the client (browser GPS → Google, else IP geolocation). */
export async function detectUserCountry(): Promise<DetectedCountryPayload | null> {
  try {
    const coords = await getBrowserCoords();
    const res = coords
      ? await fetch("/api/geo/country", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(coords),
          cache: "no-store",
        })
      : await fetch("/api/geo/country", { cache: "no-store" });

    if (!res.ok) return null;
    return (await res.json()) as DetectedCountryPayload;
  } catch {
    return null;
  }
}
