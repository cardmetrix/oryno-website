import { detectUserCountry } from "@/lib/geo/client-detect";
import { getCountryInfo } from "@/lib/country";

export async function syncSessionToDatabase(): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  countryCode?: string;
  currency?: string;
  countryName?: string;
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

  const res = await fetch("/api/auth/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode,
      forceCountry: Boolean(countryCode),
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

  return {
    ok: true,
    countryCode: info?.code,
    currency: info?.currency ?? json.country?.currency,
    countryName: info?.name ?? json.country?.name,
  };
}
