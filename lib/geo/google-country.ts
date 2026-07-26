import { resolveCountryCode, type SupportedCountryCode } from "@/lib/country";

type GeoResult = {
  countryCode: SupportedCountryCode;
  detectedIso: string | null;
  source: "google_geolocation" | "latlng" | "fallback";
  lat?: number;
  lng?: number;
};

function googleKey() {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    ""
  );
}

async function reverseGeocodeCountry(
  lat: number,
  lng: number,
  key: string,
): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("result_type", "country");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: Array<{
      address_components?: Array<{
        short_name?: string;
        types?: string[];
      }>;
    }>;
  };

  for (const result of json.results ?? []) {
    const country = result.address_components?.find((c) =>
      c.types?.includes("country"),
    );
    if (country?.short_name) return country.short_name.toUpperCase();
  }
  return null;
}

/** IP / wifi based location via Google Geolocation API, then reverse-geocode country. */
export async function detectCountryWithGoogle(opts?: {
  lat?: number;
  lng?: number;
}): Promise<GeoResult> {
  const key = googleKey();
  if (!key) {
    return {
      countryCode: resolveCountryCode("NG"),
      detectedIso: null,
      source: "fallback",
    };
  }

  try {
    let lat = opts?.lat;
    let lng = opts?.lng;

    if (lat == null || lng == null) {
      const geoRes = await fetch(
        `https://www.googleapis.com/geolocation/v1/geolocate?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ considerIp: true }),
          cache: "no-store",
        },
      );

      if (geoRes.ok) {
        const geoJson = (await geoRes.json()) as {
          location?: { lat?: number; lng?: number };
        };
        lat = geoJson.location?.lat;
        lng = geoJson.location?.lng;
      }
    }

    if (lat == null || lng == null) {
      return {
        countryCode: resolveCountryCode("NG"),
        detectedIso: null,
        source: "fallback",
      };
    }

    const iso = await reverseGeocodeCountry(lat, lng, key);
    return {
      countryCode: resolveCountryCode(iso),
      detectedIso: iso,
      source: opts?.lat != null ? "latlng" : "google_geolocation",
      lat,
      lng,
    };
  } catch (error) {
    console.error("[google-country]", error);
    return {
      countryCode: resolveCountryCode("NG"),
      detectedIso: null,
      source: "fallback",
    };
  }
}
