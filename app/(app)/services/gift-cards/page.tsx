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
  CheckCircle2,
  Clock3,
  Gift,
  ImagePlus,
  Search,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceInstructions } from "@/components/app/service-instructions";
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

type Quote = {
  ratePerUnit: number;
  providerPayout: number;
  userPayout: number;
  currency: string;
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

function brandImageSrc(brand: Brand) {
  if (brand.image?.endsWith(".png") || brand.image?.endsWith(".svg")) {
    return brand.image;
  }
  return `/gift-cards/${brand.slug}.svg`;
}

export default function GiftCardsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
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
        const res = await fetch("/api/sogo/catalog");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load brands");
        if (cancelled) return;
        const list: Brand[] = data.brands ?? [];
        setBrands(list);
        setDemo(Boolean(data.demo));
        if (list[0]) setSelected(list[0]);
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
        subtitle="Sell gift cards for instant Naira wallet credit"
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
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[28px] border border-border bg-background p-6 shadow-[var(--shadow-soft)] sm:p-8"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600">
                {successStatus === "completed" ? (
                  <CheckCircle2 className="h-7 w-7" />
                ) : (
                  <Clock3 className="h-7 w-7 text-amber-600" />
                )}
              </div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight">
                {successStatus === "completed"
                  ? "Trade completed"
                  : "Trade submitted"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {successStatus === "completed"
                  ? `${receiptAmount} was credited to your wallet.`
                  : `We’re reviewing your card. Expected credit: ${receiptAmount}.`}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Ref: {receiptRef}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {transactionId ? (
                  <Link
                    href={`/history/${transactionId}`}
                    className="btn-primary inline-flex h-11 items-center px-5"
                  >
                    View receipt
                  </Link>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary inline-flex h-11 items-center px-5"
                  onClick={() => setSuccess(false)}
                >
                  Sell another
                </button>
              </div>
            </motion.div>
          </MotionSection>
        ) : (
          <div key="form" className="space-y-5">
            <MotionSection className="rounded-[24px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Gift className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Sell for wallet credit</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Choose a brand, enter your e-code or upload a physical card,
                    and get paid in Naira when the trade clears.
                    {demo ? " Demo mode is on until API keys are set." : null}
                  </p>
                </div>
              </div>
            </MotionSection>

            <MotionSection delay={0.04}>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search brands"
                  className="h-12 w-full rounded-2xl border border-border bg-background pr-4 pl-10 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                      category === c
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </MotionSection>

            <MotionSection delay={0.06}>
              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] animate-pulse rounded-[20px] bg-muted"
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {filtered.map((brand, index) => {
                    const active = selected?.slug === brand.slug;
                    return (
                      <motion.button
                        key={brand.slug}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.02, 0.3) }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setSelected(brand)}
                        className={cn(
                          "overflow-hidden rounded-[20px] border text-left transition",
                          active
                            ? "border-primary ring-2 ring-primary/25"
                            : "border-border bg-background",
                        )}
                      >
                        <div className="relative aspect-[3/4] bg-muted">
                          <Image
                            src={brandImageSrc(brand)}
                            alt={brand.name}
                            fill
                            sizes="(max-width: 640px) 50vw, 25vw"
                            className="object-cover"
                            unoptimized={brandImageSrc(brand).endsWith(".svg")}
                          />
                        </div>
                        <div className="p-3">
                          <p className="truncate text-sm font-semibold">
                            {brand.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {brand.category}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </MotionSection>

            {selected ? (
              <MotionSection delay={0.08}>
                <form
                  onSubmit={onSubmit}
                  className="space-y-4 rounded-[24px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-11 overflow-hidden rounded-lg bg-muted">
                      <Image
                        src={brandImageSrc(selected)}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized={brandImageSrc(selected).endsWith(".svg")}
                      />
                    </div>
                    <div>
                      <p className="font-semibold">{selected.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Sell · live rates
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(selected.cardTypes.includes("ecode")
                      ? (["ecode", "physical"] as const)
                      : (["physical"] as const)
                    )
                      .filter((t) => selected.cardTypes.includes(t))
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setCardType(t)}
                          className={cn(
                            "h-11 rounded-xl text-sm font-semibold",
                            cardType === t
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {t === "ecode" ? "E-code" : "Physical"}
                        </button>
                      ))}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Card country
                      <select
                        value={cardCountry}
                        onChange={(e) => setCardCountry(e.target.value)}
                        className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
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
                        className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                      >
                        {selected.currencies.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div>
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
                            "rounded-full px-3 py-1.5 text-xs font-semibold",
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
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Receipt type
                      <select
                        value={subType}
                        onChange={(e) =>
                          setSubType(
                            e.target.value as typeof subType,
                          )
                        }
                        className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"
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
                    <label className="block text-xs font-semibold text-muted-foreground">
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
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        Card photos (1–5)
                      </p>
                      <label className="mt-2 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground">
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

                  <div className="rounded-2xl bg-muted/60 px-4 py-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">You receive</span>
                      <span className="inline-flex items-center gap-1.5 font-bold">
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
                        ≈ ₦{quote.ratePerUnit.toLocaleString("en-NG")} per{" "}
                        {cardCurrency} 1
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !quote}
                    className="btn-primary flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? "Submitting…" : "Sell gift card"}
                  </button>
                </form>
              </MotionSection>
            ) : null}

            <ServiceInstructions
              service="gift-cards"
              className="mt-1"
              delay={0.1}
            />
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
