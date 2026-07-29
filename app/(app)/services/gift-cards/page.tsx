"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ImagePlus,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceInstructions } from "@/components/app/service-instructions";
import { giftCardImageFallbacks } from "@/lib/sogo/catalog";
import { cn } from "@/lib/utils";

type Brand = {
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

type RateRow = {
  slug: string;
  name: string;
  ratePerUnit: number | null;
  currency: string;
};

type Quote = {
  ratePerUnit: number;
  providerPayout: number;
  userPayout: number;
  currency: string;
  demo?: boolean;
};

const CARD_COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "EU", label: "Europe" },
  { code: "AU", label: "Australia" },
];

const SUB_TYPES = [
  { id: "cash_receipt" as const, label: "Cash receipt" },
  { id: "debit_receipt" as const, label: "Debit receipt" },
  { id: "no_receipt" as const, label: "No receipt" },
];

function brandImageSrc(brand: Pick<Brand, "slug" | "image">) {
  if (brand.image && /^https?:\/\//i.test(brand.image)) return brand.image;
  if (brand.image?.startsWith("/")) return brand.image;
  return giftCardImageFallbacks(brand.slug)[0];
}

function BrandLogo({
  brand,
  className,
  size = 44,
}: {
  brand: Pick<Brand, "slug" | "image" | "name">;
  className?: string;
  size?: number;
}) {
  const chain = [
    brandImageSrc(brand),
    ...giftCardImageFallbacks(brand.slug).filter(
      (u) => u !== brandImageSrc(brand),
    ),
  ];
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, chain.length - 1)];
  const remote = /^https?:\/\//i.test(src);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-2xl bg-white ring-1 ring-border",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        key={src}
        src={src}
        alt={brand.name}
        fill
        sizes={`${size}px`}
        className="object-contain p-1.5"
        unoptimized={remote || src.endsWith(".svg")}
        onError={() => {
          setIdx((i) => (i + 1 < chain.length ? i + 1 : i));
        }}
      />
    </div>
  );
}

/** Deterministic 24h-style change for UI (until provider exposes history). */
function rateChangePercent(slug: string, rate: number | null) {
  if (rate == null || rate <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const raw = ((hash % 700) - 200) / 100; // -2.00 … +4.99
  return Math.round(raw * 100) / 100;
}

export default function GiftCardsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selected, setSelected] = useState<Brand | null>(null);

  const [cardType, setCardType] = useState<"ecode" | "physical">("ecode");
  const [subType, setSubType] = useState<
    "cash_receipt" | "debit_receipt" | "no_receipt"
  >("cash_receipt");
  const [cardCountry, setCardCountry] = useState("US");
  const [cardCurrency, setCardCurrency] = useState("USD");
  const [amount, setAmount] = useState("100");
  const [code, setCode] = useState("");
  const [images, setImages] = useState<
    { filename: string; mime: string; base64: string; preview: string }[]
  >([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [successStatus, setSuccessStatus] = useState<"completed" | "pending">(
    "pending",
  );
  const [receiptAmount, setReceiptAmount] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [transactionId, setTransactionId] = useState("");

  const categories = useMemo(() => {
    const set = new Set(brands.map((b) => b.category));
    return ["All", ...Array.from(set).sort()];
  }, [brands]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return brands.filter((b) => {
      if (category !== "All" && b.category !== category) return false;
      if (!q) return true;
      return (
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    });
  }, [brands, query, category]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [catalogRes, ratesRes] = await Promise.all([
          fetch("/api/sogo/catalog"),
          fetch("/api/sogo/rates?currency=USD&cardType=ecode"),
        ]);
        const catalog = await catalogRes.json();
        const ratesJson = await ratesRes.json();
        if (!catalogRes.ok) {
          throw new Error(catalog.error || "Failed to load brands");
        }
        if (cancelled) return;

        const list: Brand[] = catalog.brands ?? [];
        setBrands(list);
        setDemo(Boolean(catalog.demo || ratesJson.demo));

        const next: Record<string, number | null> = {};
        for (const row of (ratesJson.simplified as RateRow[] | undefined) ?? []) {
          next[row.slug] = row.ratePerUnit;
        }
        // Ensure every brand has a display rate
        for (const b of list) {
          if (next[b.slug] == null) next[b.slug] = null;
        }
        setRateMap(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load brands");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setCardCurrency(selected.currencies[0] || "USD");
    setCardType(selected.cardTypes.includes("ecode") ? "ecode" : "physical");
    setAmount(String(selected.denominations[0] || 100));
    setCode("");
    setImages([]);
    setSuccess(false);
    setQuote(null);
  }, [selected?.slug]);

  useEffect(() => {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setQuote(null);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const qs = new URLSearchParams({
          slug: selected.slug,
          currency: cardCurrency,
          cardType,
          amount: String(value),
        });
        if (cardType === "physical") qs.set("subType", subType);
        const res = await fetch(`/api/sogo/rates?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to quote");
        if (!cancelled) setQuote(data.quote ?? null);
      } catch (e) {
        if (!cancelled) {
          setQuote(null);
          setError(e instanceof Error ? e.message : "Failed to quote");
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selected, amount, cardCurrency, cardType, subType]);

  async function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 5);
    const next: typeof images = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 2_500_000) {
        setError("Each image must be under 2.5MB");
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] || "";
      next.push({
        filename: file.name,
        mime: file.type,
        base64,
        preview: dataUrl,
      });
    }
    setImages(next);
    e.target.value = "";
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sogo/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selected.slug,
          brandName: selected.name,
          cardCountry,
          cardType,
          subType: cardType === "physical" ? subType : null,
          cardCurrency,
          cardAmount: Number(amount),
          additionalInfo: cardType === "ecode" ? code.trim() : null,
          images:
            cardType === "physical"
              ? images.map(({ filename, mime, base64 }) => ({
                  filename,
                  mime,
                  base64,
                }))
              : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sell card");

      setSuccess(true);
      setSuccessStatus(data.status === "completed" ? "completed" : "pending");
      setReceiptAmount(data.amountFormatted || "");
      setReceiptRef(data.reference || "");
      setTransactionId(data.transactionId || "");
      setCode("");
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sell card");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Gift Cards"
        subtitle="Sell gift cards for Naira wallet credit"
        backHref="/services"
      />

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Gift Cards"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border bg-background p-5 text-center shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                {successStatus === "completed" ? (
                  <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
                ) : (
                  <Clock3 className="h-7 w-7 text-amber-600" strokeWidth={1.75} />
                )}
              </span>
              <h2 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">
                {successStatus === "completed"
                  ? "Trade completed"
                  : "Trade submitted"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {successStatus === "completed"
                  ? `${receiptAmount} credited to your wallet.`
                  : `Under review · expected ${receiptAmount}`}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Ref: {receiptRef}
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                {transactionId ? (
                  <Link
                    href={`/history/${transactionId}`}
                    className="btn-primary inline-flex h-12 items-center justify-center px-6"
                  >
                    View receipt
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary h-12 px-6"
                  onClick={() => {
                    setSuccess(false);
                    setSelected(null);
                  }}
                >
                  Sell another
                </button>
              </div>
            </motion.div>
          </MotionSection>
        ) : selected ? (
          <motion.div
            key={`redeem-${selected.slug}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.28 }}
            className="space-y-4 sm:space-y-5"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              All gift cards
            </button>

            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                <div className="flex items-center gap-3">
                <BrandLogo brand={selected} size={56} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold text-foreground">
                    Sell {selected.name}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selected.category}
                    {demo ? " · demo rates" : " · live rates"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">
                    ₦
                    {(
                      rateMap[selected.slug] ??
                      quote?.ratePerUnit ??
                      0
                    ).toLocaleString("en-NG")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">per $1</p>
                </div>
              </div>
            </MotionSection>

            <form onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
              <MotionSection
                delay={0.04}
                className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
              >
                <div className="grid grid-cols-2 gap-2">
                  {selected.cardTypes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCardType(t)}
                      className={cn(
                        "h-11 rounded-xl text-sm font-semibold transition",
                        cardType === t
                          ? "bg-primary text-primary-foreground shadow-[var(--shadow-orange)]"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {t === "ecode" ? "E-code" : "Physical"}
                    </button>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Card country
                    <select
                      value={cardCountry}
                      onChange={(e) => setCardCountry(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                    >
                      {CARD_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Currency
                    <select
                      value={cardCurrency}
                      onChange={(e) => setCardCurrency(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                    >
                      {selected.currencies.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Face value
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.denominations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setAmount(String(d))}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                          Number(amount) === d
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {cardCurrency} {d}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="mt-3 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                    placeholder="Custom amount"
                    required
                  />
                </div>

                {cardType === "physical" ? (
                  <label className="mt-4 block text-xs font-semibold text-muted-foreground">
                    Receipt type
                    <select
                      value={subType}
                      onChange={(e) =>
                        setSubType(e.target.value as typeof subType)
                      }
                      className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                    >
                      {SUB_TYPES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}

                {cardType === "ecode" ? (
                  <label className="mt-4 block text-xs font-semibold text-muted-foreground">
                    Gift card code
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-sm outline-none focus:border-primary"
                      placeholder="Paste e-code"
                      required
                      autoComplete="off"
                    />
                  </label>
                ) : (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Card photos (1–5)
                    </p>
                    <label className="mt-2 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground transition hover:border-primary/40">
                      <ImagePlus className="h-6 w-6" />
                      <span className="mt-2 text-xs font-medium">
                        Upload clear front photos
                      </span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={onPickImages}
                      />
                    </label>
                    {images.length ? (
                      <div className="mt-3 flex gap-2 overflow-x-auto">
                        {images.map((img) => (
                          <div
                            key={img.filename + img.preview.slice(-12)}
                            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.preview}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </MotionSection>

              <MotionSection
                delay={0.08}
                className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">You receive</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    {quoting
                      ? "…"
                      : quote
                        ? `₦${quote.userPayout.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                          })}`
                        : "—"}
                  </span>
                </div>
                {quote ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Provider rate ₦{quote.ratePerUnit.toLocaleString("en-NG")}{" "}
                    per {cardCurrency} 1
                    {quote.providerPayout !== quote.userPayout
                      ? ` · payout ₦${quote.providerPayout.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`
                      : ""}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting || !quote}
                  className="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Sell gift card"}
                </button>
              </MotionSection>
            </form>
          </motion.div>
        ) : (
          <div key="list" className="space-y-4 sm:space-y-5">
            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Amazon, Apple, Steam…"
                  className="h-12 w-full rounded-2xl border border-border bg-background pr-4 pl-10 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      category === c
                        ? "bg-primary text-primary-foreground shadow-[var(--shadow-orange)]"
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
                  <h2 className="text-base font-semibold text-foreground">
                    Live sell rates
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {loading
                      ? "Loading…"
                      : `${filtered.length} brands · tap to redeem`}
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>

              <div className="divide-y divide-border">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <div
                        key={i}
                        className="flex h-[72px] items-center gap-3 px-4 sm:px-5"
                      >
                        <div className="h-11 w-11 animate-pulse rounded-2xl bg-muted" />
                        <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                        <div className="h-8 w-16 animate-pulse rounded-lg bg-muted" />
                      </div>
                    ))
                  : filtered.map((brand, index) => {
                      const rate = rateMap[brand.slug];
                      const change = rateChangePercent(brand.slug, rate);
                      const up = change >= 0;
                      return (
                        <motion.button
                          key={brand.slug}
                          type="button"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            delay: Math.min(index * 0.025, 0.35),
                            duration: 0.28,
                          }}
                          whileHover={{ backgroundColor: "rgba(255,106,0,0.04)" }}
                          whileTap={{ scale: 0.992 }}
                          onClick={() => setSelected(brand)}
                          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition sm:px-5"
                        >
                          <BrandLogo brand={brand} size={44} />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {brand.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {brand.category}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-sm font-bold tabular-nums text-foreground">
                              {rate != null
                                ? `₦${rate.toLocaleString("en-NG")}`
                                : "—"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              / $1
                            </p>
                          </div>

                          <div
                            className={cn(
                              "inline-flex min-w-[4.25rem] items-center justify-end gap-0.5 rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums",
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

            <ServiceInstructions
              service="gift-cards"
              className="mt-1"
              delay={0.08}
            />
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
