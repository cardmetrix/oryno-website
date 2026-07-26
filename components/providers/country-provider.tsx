"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_COUNTRY_CODE,
  getCountryInfo,
  type CountryInfo,
  type SupportedCountryCode,
} from "@/lib/country";

type CountryContextValue = {
  country: CountryInfo;
  loading: boolean;
  setCountryCode: (code: SupportedCountryCode) => Promise<void>;
  refresh: () => Promise<void>;
};

const CountryContext = createContext<CountryContextValue | null>(null);

function readCachedCountry(): CountryInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("oryno_country");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { countryCode?: string };
    if (!parsed.countryCode) return null;
    return getCountryInfo(parsed.countryCode);
  } catch {
    return null;
  }
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountry] = useState<CountryInfo>(
    () => readCachedCountry() ?? getCountryInfo(DEFAULT_COUNTRY_CODE),
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/country", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { country: CountryInfo };
      setCountry(json.country);
      window.localStorage.setItem(
        "oryno_country",
        JSON.stringify({
          countryCode: json.country.code,
          currency: json.country.currency,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // keep cached / default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    function onCountryUpdated(event: Event) {
      const detail = (event as CustomEvent<{ countryCode?: string }>).detail;
      if (detail?.countryCode) {
        setCountry(getCountryInfo(detail.countryCode));
      }
      void refresh();
    }
    window.addEventListener("oryno:country-updated", onCountryUpdated);
    return () => {
      window.removeEventListener("oryno:country-updated", onCountryUpdated);
    };
  }, [refresh]);

  const setCountryCode = useCallback(async (code: SupportedCountryCode) => {
    const optimistic = getCountryInfo(code);
    setCountry(optimistic);
    const res = await fetch("/api/me/country", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ countryCode: code }),
    });
    if (!res.ok) throw new Error("Failed to update country");
    const json = (await res.json()) as { country: CountryInfo };
    setCountry(json.country);
    window.localStorage.setItem(
      "oryno_country",
      JSON.stringify({
        countryCode: json.country.code,
        currency: json.country.currency,
        updatedAt: Date.now(),
      }),
    );
  }, []);

  const value = useMemo(
    () => ({ country, loading, setCountryCode, refresh }),
    [country, loading, setCountryCode, refresh],
  );

  return (
    <CountryContext.Provider value={value}>{children}</CountryContext.Provider>
  );
}

export function useCountry() {
  const ctx = useContext(CountryContext);
  if (!ctx) {
    return {
      country: getCountryInfo(DEFAULT_COUNTRY_CODE),
      loading: false,
      setCountryCode: async () => undefined,
      refresh: async () => undefined,
    } satisfies CountryContextValue;
  }
  return ctx;
}
