"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Search,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import {
  GiftCardBrandLogo,
  giftCardRateChangePercent,
} from "@/components/app/gift-card-brand-logo";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { useCountry } from "@/components/providers/country-provider";
import { cn } from "@/lib/utils";

type Mode = "sell" | "buy";

type SellBrand = {
  slug: string;
  name: string;
  category: string;
  image: string;
  currencies: string[];
  denominations: number[];
  cardTypes: Array<"ecode" | "physical">;
  requiresPin: boolean;
  active: boolean;
};

type BuyProduct = {
  productId: number;
  name: string;
  brandName: string;
  countryCode: string;
  image: string;
  imageFallbacks?: string[];
  denominationType: string;
  recipientCurrency: string;
  denominations: number[];
  minAmount: number | null;
  maxAmount: number | null;
};

const FALLBACK_BUY_COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "NG", label: "Nigeria" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
];

export default function GiftCardsLivePage() {
  const router = useRouter();
  const { formatServiceMoney } = useCountry();
  const [mode] = useState<Mode>("buy");
  const setMode = (_: Mode) => {};

  const [sellBrands, setSellBrands] = useState<SellBrand[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});
  const [sellLoading, setSellLoading] = useState(true);
  const [sellDemo, setSellDemo] = useState(false);
  const [sellUnavailable, setSellUnavailable] = useState(false);
  const [sellPartnerError, setSellPartnerError] = useState<string | null>(null);
  const [sellQuery, setSellQuery] = useState("");
  const [sellCategory, setSellCategory] = useState("All");

  const [buyProducts, setBuyProducts] = useState<BuyProduct[]>([]);
  const [buyCountries, setBuyCountries] = useState(FALLBACK_BUY_COUNTRIES);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buyDemo, setBuyDemo] = useState(false);
  const [buySandbox, setBuySandbox] = useState(false);
  const [buyQuery, setBuyQuery] = useState("");
  const [buyCountry, setBuyCountry] = useState("US");

  const sellCategories = useMemo(() => {
    const set = new Set(sellBrands.map((b) => b.category));
    return ["All", ...Array.from(set).sort()];
  }, [sellBrands]);

  const filteredSell = useMemo(() => {
    const q = sellQuery.trim().toLowerCase();
    return sellBrands.filter((b) => {
      if (sellCategory !== "All" && b.category !== sellCategory) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [sellBrands, sellQuery, sellCategory]);

  const filteredBuy = useMemo(() => {
    const q = buyQuery.trim().toLowerCase();
    if (!q) return buyProducts;
    return buyProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q),
    );
  }, [buyProducts, buyQuery]);

  const loadSell = useCallback(async () => {
    setSellLoading(true);
    try {
      const [catalogRes, ratesRes] = await Promise.all([
        fetch("/api/sogo/catalog"),
        fetch("/api/sogo/rates?currency=USD&cardType=ecode"),
      ]);
      const catalog = await catalogRes.json();
      const ratesJson = await ratesRes.json().catch(() => ({}));
      if (!catalogRes.ok) throw new Error(catalog.error || "Failed to load");
      setSellBrands(catalog.brands ?? []);
      setSellDemo(Boolean(catalog.demo || ratesJson.demo));
      setSellUnavailable(Boolean(catalog.unavailable || ratesJson.unavailable));
      setSellPartnerError(
        (typeof ratesJson.partnerError === "string" && ratesJson.partnerError) ||
          (typeof catalog.partnerError === "string" && catalog.partnerError) ||
          null,
      );

      // API exposes NGN-per-$1 on `simplified` (raw `rates` has nested provider shape).
      const map: Record<string, number | null> = {};
      const rows = Array.isArray(ratesJson.simplified)
        ? ratesJson.simplified
        : [];
      for (const row of rows) {
        if (row?.slug) {
          map[row.slug] =
            typeof row.ratePerUnit === "number" ? row.ratePerUnit : null;
        }
      }
      setRateMap(map);
    } catch {
      setSellBrands([]);
      setRateMap({});
    } finally {
      setSellLoading(false);
    }
  }, []);

  const loadBuyCountries = useCallback(async () => {
    try {
      const res = await fetch("/api/reloadly/countries");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load countries");
      const rows = Array.isArray(data.countries) ? data.countries : [];
      if (rows.length) {
        setBuyCountries(
          rows.map((c: { code: string; label: string }) => ({
            code: String(c.code).toUpperCase(),
            label: String(c.label),
          })),
        );
        setBuyCountry((prev) => {
          const codes = new Set(
            rows.map((c: { code: string }) => String(c.code).toUpperCase()),
          );
          return codes.has(prev) ? prev : String(rows[0].code).toUpperCase();
        });
      }
      setBuyDemo(Boolean(data.demo));
      setBuySandbox(Boolean(data.sandbox));
    } catch {
      setBuyCountries(FALLBACK_BUY_COUNTRIES);
    }
  }, []);

  const loadBuy = useCallback(async () => {
    setBuyLoading(true);
    setBuyError(null);
    try {
      const res = await fetch(
        `/api/reloadly/products?countryCode=${encodeURIComponent(buyCountry)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBuyProducts(data.products ?? []);
      setBuyDemo(Boolean(data.demo));
      setBuySandbox(Boolean(data.sandbox));
    } catch (e) {
      setBuyProducts([]);
      setBuyError(
        e instanceof Error ? e.message : "Failed to load gift cards",
      );
    } finally {
      setBuyLoading(false);
    }
  }, [buyCountry]);

  useEffect(() => {
    void loadSell();
  }, [loadSell]);

  useEffect(() => {
    if (mode === "buy") void loadBuyCountries();
  }, [mode, loadBuyCountries]);

  useEffect(() => {
    if (mode === "buy") void loadBuy();
  }, [mode, loadBuy]);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Gift Card Live"
        subtitle="Live rates · tap a card to trade"
        backHref="/services"
      />

      <MotionSection className="mb-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background p-1.5 shadow-[var(--shadow-soft)]">
          {(["buy"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={cn(
                "h-11 rounded-xl text-sm font-semibold capitalize transition",
                mode === tab
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-orange)]"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </MotionSection>

      {mode === "sell" ? (
        <div className="space-y-4">
          <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={sellQuery}
                onChange={(e) => setSellQuery(e.target.value)}
                placeholder="Search Amazon, Apple, Steam…"
                className="h-12 w-full rounded-2xl border border-border bg-background pr-4 pl-10 text-base outline-none focus:border-primary sm:text-sm"
              />
            </div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {sellCategories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSellCategory(c)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold",
                    sellCategory === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </MotionSection>

          <MotionSection
            delay={0.04}
            className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-soft)] sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-base font-semibold">Live sell rates</h2>
                <p className="text-xs text-muted-foreground">
                  {sellLoading
                    ? "Loading…"
                    : `${filteredSell.length} brands · tap to sell`}
                  {sellDemo
                    ? " · demo rates"
                    : sellUnavailable
                      ? " · indicative rates"
                      : ""}
                </p>
                {sellUnavailable && sellPartnerError ? (
                  <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                    {sellPartnerError}
                  </p>
                ) : null}
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="divide-y divide-border">
              {sellLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex h-[72px] items-center gap-3 px-4"
                    >
                      <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                    </div>
                  ))
                : filteredSell.map((brand, index) => {
                    const rate = rateMap[brand.slug];
                    const change = giftCardRateChangePercent(brand.slug, rate);
                    const up = change >= 0;
                    return (
                      <motion.button
                        key={brand.slug}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: Math.min(index * 0.025, 0.35),
                        }}
                        whileTap={{ scale: 0.992 }}
                        onClick={() =>
                          router.push(
                            `/services/gift-cards?mode=sell&slug=${encodeURIComponent(brand.slug)}`,
                          )
                        }
                        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                      >
                        <GiftCardBrandLogo
                          brand={{
                            slug: brand.slug,
                            image: brand.image,
                            name: brand.name,
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {brand.name}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {brand.category}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">
                            {rate != null ? formatServiceMoney(rate) : "—"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            / $1
                          </p>
                        </div>
                        <div
                          className={cn(
                            "inline-flex min-w-[4.25rem] items-center justify-end gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold",
                            up
                              ? "bg-emerald-500/12 text-emerald-600"
                              : "bg-rose-500/12 text-rose-600",
                          )}
                        >
                          {up ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {up ? "+" : ""}
                          {change.toFixed(2)}%
                        </div>
                      </motion.button>
                    );
                  })}
            </div>
          </MotionSection>
        </div>
      ) : (
        <div className="space-y-4">
          <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
            <label className="mb-3 block text-xs font-semibold text-muted-foreground">
              Card country
              <select
                value={buyCountry}
                onChange={(e) => setBuyCountry(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
              >
                {buyCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={buyQuery}
                onChange={(e) => setBuyQuery(e.target.value)}
                placeholder="Search brands to buy…"
                className="h-12 w-full rounded-2xl border border-border bg-background pr-4 pl-10 text-base outline-none focus:border-primary sm:text-sm"
              />
            </div>
          </MotionSection>

          <MotionSection
            delay={0.04}
            className="overflow-hidden rounded-2xl border border-border bg-background shadow-[var(--shadow-soft)] sm:rounded-[28px]"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-base font-semibold">Buy gift cards</h2>
                <p className="text-xs text-muted-foreground">
                  {buyLoading
                    ? "Loading…"
                    : `${filteredBuy.length} products · tap to buy`}
                  {buyDemo
                    ? " · demo catalog"
                    : buySandbox
                      ? " · sandbox"
                      : " · live"}
                </p>
              </div>
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            {buyError ? (
              <div className="border-b border-border px-4 py-4 text-sm text-destructive sm:px-5">
                {buyError}
              </div>
            ) : null}
            <div className="divide-y divide-border">
              {!buyLoading && !buyError && filteredBuy.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
                  No gift cards for this country yet. Try another country.
                </p>
              ) : null}
              {buyLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex h-[72px] items-center gap-3 px-4"
                    >
                      <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
                      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                    </div>
                  ))
                : filteredBuy.map((product, index) => {
                    const from =
                      product.denominations[0] ?? product.minAmount ?? 10;
                    return (
                      <motion.button
                        key={product.productId}
                        type="button"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          delay: Math.min(index * 0.025, 0.35),
                        }}
                        whileTap={{ scale: 0.992 }}
                        onClick={() =>
                          router.push(
                            `/services/gift-cards?mode=buy&productId=${product.productId}&country=${encodeURIComponent(buyCountry)}`,
                          )
                        }
                        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                      >
                        <GiftCardBrandLogo
                          brand={{
                            image: product.image,
                            name: product.brandName,
                          }}
                          fallbacks={product.imageFallbacks}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {product.brandName}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {product.name}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">
                            from {product.recipientCurrency} {from}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {product.countryCode}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
            </div>
          </MotionSection>
        </div>
      )}

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Prefer the form directly?{" "}
        <Link
          href="/services/gift-cards"
          className="font-semibold text-primary underline-offset-2 hover:underline"
        >
          Open Gift Cards
        </Link>
      </p>
    </AppShell>
  );
}
