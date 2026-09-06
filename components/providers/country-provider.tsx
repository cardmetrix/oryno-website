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
  formatCountryMoney,
  getCountryInfo,
  type CountryInfo,
  type SupportedCountryCode,
} from "@/lib/country";

export type DisplayFx = {
  from: "NGN";
  to: string;
  ngnToLocal: number;
  localToNgn: number;
  provider?: string;
  asOf?: string;
};

type CountryContextValue = {
  country: CountryInfo;
  displayFx: DisplayFx | null;
  loading: boolean;
  setCountryCode: (code: SupportedCountryCode) => Promise<void>;
  refresh: () => Promise<void>;
  /** Format a Nigeria-priced (NGN) amount in the user's display currency. */
  formatServiceMoney: (ngnAmount: string | number) => string;
};

const CountryContext = createContext<CountryContextValue | null>(null);

const COUNTRY_FRESH_MS = 5 * 60 * 1000;

function readCachedCountryMeta(): {
  country: CountryInfo;
  updatedAt: number;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("oryno_country");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      countryCode?: string;
      updatedAt?: number;
    };
    if (!parsed.countryCode) return null;
    return {
      country: getCountryInfo(parsed.countryCode),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return null;
  }
}

function readCachedCountry(): CountryInfo | null {
  return readCachedCountryMeta()?.country ?? null;
}

function readCachedFx(): DisplayFx | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("oryno_display_fx");
    if (!raw) return null;
    return JSON.parse(raw) as DisplayFx;
  } catch {
    return null;
  }
}

function persistCountry(country: CountryInfo, displayFx?: DisplayFx | null) {
  window.localStorage.setItem(
    "oryno_country",
    JSON.stringify({
      countryCode: country.code,
      currency: country.currency,
      updatedAt: Date.now(),
    }),
  );
  if (displayFx) {
    window.localStorage.setItem("oryno_display_fx", JSON.stringify(displayFx));
  }
}

export function CountryProvider({ children }: { children: React.ReactNode }) {
  const [country, setCountry] = useState<CountryInfo>(
    () => readCachedCountry() ?? getCountryInfo(DEFAULT_COUNTRY_CODE),
  );
  const [displayFx, setDisplayFx] = useState<DisplayFx | null>(() =>
    readCachedFx(),
  );
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me/country", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as {
        country: CountryInfo;
        displayFx?: DisplayFx;
      };
      setCountry(json.country);
      if (json.displayFx) setDisplayFx(json.displayFx);
      persistCountry(json.country, json.displayFx);
    } catch {
      // keep cached / default
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = readCachedCountryMeta();
    if (cached && Date.now() - cached.updatedAt < COUNTRY_FRESH_MS) {
      setLoading(false);
      return;
    }
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
    const json = (await res.json()) as {
      country: CountryInfo;
      displayFx?: DisplayFx;
    };
    setCountry(json.country);
    if (json.displayFx) setDisplayFx(json.displayFx);
    persistCountry(json.country, json.displayFx);
  }, []);

  const formatServiceMoney = useCallback(
    (ngnAmount: string | number) => {
      const raw = typeof ngnAmount === "number" ? ngnAmount : Number(ngnAmount);
      const rate =
        country.code === "NG" ? 1 : (displayFx?.ngnToLocal ?? 1);
      const converted = Number.isFinite(raw) ? raw * rate : 0;
      return formatCountryMoney(converted, country.code);
    },
    [country.code, displayFx],
  );

  const value = useMemo(
    () => ({
      country,
      displayFx,
      loading,
      setCountryCode,
      refresh,
      formatServiceMoney,
    }),
    [country, displayFx, loading, setCountryCode, refresh, formatServiceMoney],
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
      displayFx: null,
      loading: false,
      setCountryCode: async () => undefined,
      refresh: async () => undefined,
      formatServiceMoney: (n) => formatCountryMoney(n, DEFAULT_COUNTRY_CODE),
    } satisfies CountryContextValue;
  }
  return ctx;
}
