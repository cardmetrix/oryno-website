import { detectUserCountry } from "@/lib/geo/client-detect";

export async function syncSessionToDatabase(): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  countryCode?: string;
  currency?: string;
}> {
  let countryCode: string | undefined;
  let lat: number | undefined;
  let lng: number | undefined;

  try {
    const detected = await detectUserCountry();
    if (detected?.countryCode) {
      countryCode = detected.countryCode;
    }
  } catch {
    // server will fall back to Google IP geolocation
  }

  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode,
      lat,
      lng,
      forceCountry: true,
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
    country?: { code?: string; currency?: string };
  };

  if (typeof window !== "undefined" && json.country?.code) {
    window.localStorage.setItem(
      "oryno_country",
      JSON.stringify({
        countryCode: json.country.code,
        currency: json.country.currency,
        updatedAt: Date.now(),
      }),
    );
  }

  return {
    ok: true,
    countryCode: json.country?.code,
    currency: json.country?.currency,
  };
}
