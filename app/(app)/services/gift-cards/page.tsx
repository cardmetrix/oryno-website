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
  Copy,
  ImagePlus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceInstructions } from "@/components/app/service-instructions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { giftCardImageFallbacks } from "@/lib/sogo/catalog";
import { cn } from "@/lib/utils";

const MAX_CARD_IMAGE_BYTES = 2_500_000;
const MAX_CARD_IMAGES = 5;

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
  senderPriceMap: Record<string, number>;
  redeemHint: string | null;
};

type SellQuote = {
  ratePerUnit: number;
  providerPayout: number;
  userPayout: number;
  currency: string;
};

type BuyQuote = {
  usdFace: number;
  local: number;
  currency: string;
};

const CARD_COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "EU", label: "Europe" },
  { code: "AU", label: "Australia" },
];

const BUY_COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "NG", label: "Nigeria" },
  { code: "CA", label: "Canada" },
];

const SUB_TYPES = [
  { id: "cash_receipt" as const, label: "Cash receipt" },
  { id: "debit_receipt" as const, label: "Debit receipt" },
  { id: "no_receipt" as const, label: "No receipt" },
];

function brandImageSrc(brand: { slug?: string; image: string }) {
  if (brand.image && /^https?:\/\//i.test(brand.image)) return brand.image;
  if (brand.image?.startsWith("/")) return brand.image;
  return giftCardImageFallbacks(brand.slug || "gift")[0];
}

function BrandLogo({
  brand,
  className,
  size = 44,
  fallbacks,
}: {
  brand: { slug?: string; image: string; name: string };
  className?: string;
  size?: number;
  fallbacks?: string[];
}) {
  const primary = brandImageSrc(brand);
  const chain = [
    primary,
    ...(fallbacks || []),
    ...(brand.slug
      ? giftCardImageFallbacks(brand.slug).filter((u) => u !== primary)
      : []),
  ].filter((u, i, arr) => u && arr.indexOf(u) === i);
  const [idx, setIdx] = useState(0);
  const src = chain[Math.min(idx, Math.max(chain.length - 1, 0))] || primary;
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
        onError={() => setIdx((i) => (i + 1 < chain.length ? i + 1 : i))}
      />
    </div>
  );
}

function rateChangePercent(slug: string, rate: number | null) {
  if (rate == null || rate <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return Math.round((((hash % 700) - 200) / 100) * 100) / 100;
}

export default function GiftCardsPage() {
  const [mode, setMode] = useState<Mode>("sell");
  const [error, setError] = useState<string | null>(null);

  // ── Sell state ──────────────────────────────────────────────
  const [sellBrands, setSellBrands] = useState<SellBrand[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});
  const [sellLoading, setSellLoading] = useState(true);
  const [sellDemo, setSellDemo] = useState(false);
  const [sellQuery, setSellQuery] = useState("");
  const [sellCategory, setSellCategory] = useState("All");
  const [selectedSell, setSelectedSell] = useState<SellBrand | null>(null);
  const [cardType, setCardType] = useState<"ecode" | "physical">("ecode");
  const [subType, setSubType] = useState<
    "cash_receipt" | "debit_receipt" | "no_receipt"
  >("cash_receipt");
  const [cardCountry, setCardCountry] = useState("US");
  const [cardCurrency, setCardCurrency] = useState("USD");
  const [sellAmount, setSellAmount] = useState("100");
  const [code, setCode] = useState("");
  const [images, setImages] = useState<
    { filename: string; mime: string; base64: string; preview: string }[]
  >([]);
  const [sellQuote, setSellQuote] = useState<SellQuote | null>(null);
  const [sellQuoting, setSellQuoting] = useState(false);
  const [sellSubmitting, setSellSubmitting] = useState(false);
  const [sellSuccess, setSellSuccess] = useState(false);
  const [sellSuccessStatus, setSellSuccessStatus] = useState<
    "completed" | "pending"
  >("pending");
  const [sellReceiptAmount, setSellReceiptAmount] = useState("");
  const [sellReceiptRef, setSellReceiptRef] = useState("");
  const [sellTxId, setSellTxId] = useState("");
  const [changeSellOpen, setChangeSellOpen] = useState(false);
  const [changeSellQuery, setChangeSellQuery] = useState("");

  // ── Buy state ───────────────────────────────────────────────
  const [buyProducts, setBuyProducts] = useState<BuyProduct[]>([]);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyDemo, setBuyDemo] = useState(false);
  const [buyQuery, setBuyQuery] = useState("");
  const [buyCountry, setBuyCountry] = useState("US");
  const [selectedBuy, setSelectedBuy] = useState<BuyProduct | null>(null);
  const [buyAmount, setBuyAmount] = useState("25");
  const [buyEmail, setBuyEmail] = useState("");
  const [changeBuyOpen, setChangeBuyOpen] = useState(false);
  const [changeBuyQuery, setChangeBuyQuery] = useState("");
  const [buyQuote, setBuyQuote] = useState<BuyQuote | null>(null);
  const [buyQuoting, setBuyQuoting] = useState(false);
  const [buySubmitting, setBuySubmitting] = useState(false);
  const [buySuccess, setBuySuccess] = useState(false);
  const [buyReceiptAmount, setBuyReceiptAmount] = useState("");
  const [buyTxId, setBuyTxId] = useState("");
  const [buyCards, setBuyCards] = useState<
    { cardNumber: string | null; pinCode: string | null }[]
  >([]);
  const isMobile = useIsMobile();

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

  const changeSellOptions = useMemo(() => {
    const q = changeSellQuery.trim().toLowerCase();
    if (!q) return sellBrands;
    return sellBrands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [sellBrands, changeSellQuery]);

  const changeBuyOptions = useMemo(() => {
    const q = changeBuyQuery.trim().toLowerCase();
    if (!q) return buyProducts;
    return buyProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brandName.toLowerCase().includes(q),
    );
  }, [buyProducts, changeBuyQuery]);

  // Load sell catalog
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSellLoading(true);
      try {
        const [catalogRes, ratesRes] = await Promise.all([
          fetch("/api/sogo/catalog"),
          fetch("/api/sogo/rates?currency=USD&cardType=ecode"),
        ]);
        const catalog = await catalogRes.json();
        const ratesJson = await ratesRes.json();
        if (!catalogRes.ok) throw new Error(catalog.error || "Failed to load");
        if (cancelled) return;
        setSellBrands(catalog.brands ?? []);
        setSellDemo(Boolean(catalog.demo || ratesJson.demo));
        const next: Record<string, number | null> = {};
        for (const row of ratesJson.simplified ?? []) {
          next[row.slug] = row.ratePerUnit;
        }
        setRateMap(next);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load brands");
        }
      } finally {
        if (!cancelled) setSellLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load buy products when Buy tab active
  useEffect(() => {
    if (mode !== "buy") return;
    let cancelled = false;
    (async () => {
      setBuyLoading(true);
      setSelectedBuy(null);
      try {
        const res = await fetch(
          `/api/reloadly/products?countryCode=${encodeURIComponent(buyCountry)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load products");
        if (cancelled) return;
        setBuyProducts(data.products ?? []);
        setBuyDemo(Boolean(data.demo));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load products");
          setBuyProducts([]);
        }
      } finally {
        if (!cancelled) setBuyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, buyCountry]);

  useEffect(() => {
    if (!selectedSell) return;
    setCardCurrency(selectedSell.currencies[0] || "USD");
    setCardType(selectedSell.cardTypes.includes("ecode") ? "ecode" : "physical");
    setSellAmount(String(selectedSell.denominations[0] || 100));
    setCode("");
    setImages([]);
    setSellSuccess(false);
    setSellQuote(null);
  }, [selectedSell?.slug]);

  useEffect(() => {
    if (!selectedBuy) return;
    setBuyAmount(String(selectedBuy.denominations[0] || selectedBuy.minAmount || 25));
    setBuySuccess(false);
    setBuyQuote(null);
    setBuyCards([]);
  }, [selectedBuy?.productId]);

  // Sell quote
  useEffect(() => {
    if (!selectedSell) return;
    const value = Number(sellAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setSellQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSellQuoting(true);
      try {
        const qs = new URLSearchParams({
          slug: selectedSell.slug,
          currency: cardCurrency,
          cardType,
          amount: String(value),
        });
        if (cardType === "physical") qs.set("subType", subType);
        const res = await fetch(`/api/sogo/rates?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to quote");
        if (!cancelled) setSellQuote(data.quote ?? null);
      } catch (e) {
        if (!cancelled) {
          setSellQuote(null);
          setError(e instanceof Error ? e.message : "Failed to quote");
        }
      } finally {
        if (!cancelled) setSellQuoting(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedSell, sellAmount, cardCurrency, cardType, subType]);

  // Buy quote
  useEffect(() => {
    if (!selectedBuy) return;
    const value = Number(buyAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setBuyQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBuyQuoting(true);
      try {
        const qs = new URLSearchParams({
          countryCode: buyCountry,
          productId: String(selectedBuy.productId),
          unitPrice: String(value),
        });
        const res = await fetch(`/api/reloadly/products?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to quote");
        if (!cancelled) setBuyQuote(data.quote ?? null);
      } catch (e) {
        if (!cancelled) {
          setBuyQuote(null);
          setError(e instanceof Error ? e.message : "Failed to quote");
        }
      } finally {
        if (!cancelled) setBuyQuoting(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedBuy, buyAmount, buyCountry]);

  async function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const next = [...images];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setError("Please choose an image file (any image format).");
        continue;
      }
      if (file.size > MAX_CARD_IMAGE_BYTES) {
        setError("Each image must be under 2.5MB");
        continue;
      }
      if (next.length >= MAX_CARD_IMAGES) {
        setError(`You can upload up to ${MAX_CARD_IMAGES} images`);
        break;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(file);
      });
      next.push({
        filename: file.name || `card-${Date.now()}-${next.length}.img`,
        mime: file.type || "image/jpeg",
        base64: dataUrl.split(",")[1] || "",
        preview: dataUrl,
      });
    }
    setImages(next);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSellSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedSell) return;
    setSellSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/sogo/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selectedSell.slug,
          brandName: selectedSell.name,
          cardCountry,
          cardType,
          subType: cardType === "physical" ? subType : null,
          cardCurrency,
          cardAmount: Number(sellAmount),
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
      setSellSuccess(true);
      setSellSuccessStatus(data.status === "completed" ? "completed" : "pending");
      setSellReceiptAmount(data.amountFormatted || "");
      setSellReceiptRef(data.reference || "");
      setSellTxId(data.transactionId || "");
      setCode("");
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sell card");
    } finally {
      setSellSubmitting(false);
    }
  }

  async function onBuySubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedBuy) return;
    setBuySubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reloadly/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: selectedBuy.productId,
          unitPrice: Number(buyAmount),
          email: buyEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to buy card");
      setBuySuccess(true);
      setBuyReceiptAmount(data.amountFormatted || "");
      setBuyTxId(data.transactionId || "");
      setBuyCards(data.cards ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to buy card");
    } finally {
      setBuySubmitting(false);
    }
  }

  function copyText(value: string) {
    void navigator.clipboard.writeText(value);
    toast.success("Copied");
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Gift Cards"
        subtitle={
          mode === "sell"
            ? "Sell gift cards for Naira wallet credit"
            : "Buy digital gift cards with your wallet"
        }
        backHref="/services"
      />

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Gift Cards"
      />

      <MotionSection className="mb-4">
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-background p-1.5 shadow-[var(--shadow-soft)]">
          {(["sell", "buy"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setSelectedSell(null);
                setSelectedBuy(null);
                setSellSuccess(false);
                setBuySuccess(false);
              }}
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

      <AnimatePresence mode="wait">
        {mode === "sell" ? (
          <motion.div
            key="sell-root"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4 sm:space-y-5"
          >
            {sellSuccess ? (
              <MotionSection>
                <div className="rounded-2xl border border-border bg-background p-5 text-center shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                    {sellSuccessStatus === "completed" ? (
                      <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
                    ) : (
                      <Clock3 className="h-7 w-7 text-amber-600" strokeWidth={1.75} />
                    )}
                  </span>
                  <h2 className="mt-4 text-xl font-bold">
                    {sellSuccessStatus === "completed"
                      ? "Trade completed"
                      : "Trade submitted"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {sellSuccessStatus === "completed"
                      ? `${sellReceiptAmount} credited to your wallet.`
                      : `Under review · expected ${sellReceiptAmount}`}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ref: {sellReceiptRef}
                  </p>
                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {sellTxId ? (
                      <Link
                        href={`/history/${sellTxId}`}
                        className="btn-primary inline-flex h-12 items-center justify-center px-6"
                      >
                        View receipt
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary h-12 px-6"
                      onClick={() => {
                        setSellSuccess(false);
                        setSelectedSell(null);
                      }}
                    >
                      Sell another
                    </button>
                  </div>
                </div>
              </MotionSection>
            ) : selectedSell ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setSelectedSell(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All gift cards
                </button>

                <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      brand={{
                        slug: selectedSell.slug,
                        image: selectedSell.image,
                        name: selectedSell.name,
                      }}
                      size={56}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold">
                        Sell {selectedSell.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedSell.category}
                        {sellDemo ? " · demo rates" : " · live rates"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          ₦
                          {(
                            rateMap[selectedSell.slug] ??
                            sellQuote?.ratePerUnit ??
                            0
                          ).toLocaleString("en-NG")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          per $1
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setChangeSellQuery("");
                          setChangeSellOpen(true);
                        }}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition hover:border-primary/40 hover:bg-oryno-orange-muted hover:text-primary"
                        aria-label="Change gift card"
                        title="Change gift card"
                      >
                        <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                </MotionSection>

                <form onSubmit={onSellSubmit} className="space-y-4">
                  <MotionSection
                    delay={0.04}
                    className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      {selectedSell.cardTypes.map((t) => (
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

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Card country
                        <select
                          value={cardCountry}
                          onChange={(e) => setCardCountry(e.target.value)}
                          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
                          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
                        >
                          {selectedSell.currencies.map((c) => (
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
                        {selectedSell.denominations.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setSellAmount(String(d))}
                            className={cn(
                              "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                              Number(sellAmount) === d
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
                        value={sellAmount}
                        onChange={(e) => setSellAmount(e.target.value)}
                        className="mt-3 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
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
                          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
                          Card photos (1–{MAX_CARD_IMAGES}) · max 2.5MB each
                        </p>
                        <label className="mt-2 flex h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground transition hover:border-primary/40 hover:bg-oryno-orange-muted/30">
                          <ImagePlus className="h-6 w-6" />
                          <span className="mt-2 text-xs font-medium">
                            {images.length
                              ? "Add another photo"
                              : "Upload clear card photos"}
                          </span>
                          <span className="mt-1 text-[10px] text-muted-foreground">
                            Any image format · under 2.5MB
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={onPickImages}
                          />
                        </label>
                        {images.length ? (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {images.map((img, index) => (
                              <div
                                key={`${img.filename}-${index}-${img.preview.slice(-12)}`}
                                className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img.preview}
                                  alt={`Card photo ${index + 1}`}
                                  className="h-full w-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removeImage(index)}
                                  className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
                                  aria-label={`Remove photo ${index + 1}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
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
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <Wallet className="h-4 w-4 text-primary" />
                        {sellQuoting
                          ? "…"
                          : sellQuote
                            ? `₦${sellQuote.userPayout.toLocaleString("en-NG", {
                                minimumFractionDigits: 2,
                              })}`
                            : "—"}
                      </span>
                    </div>
                    {sellQuote ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Provider rate ₦
                        {sellQuote.ratePerUnit.toLocaleString("en-NG")} per{" "}
                        {cardCurrency} 1
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={sellSubmitting || !sellQuote}
                      className="btn-primary mt-4 flex h-12 w-full items-center justify-center disabled:opacity-60"
                    >
                      {sellSubmitting ? "Submitting…" : "Sell gift card"}
                    </button>
                  </MotionSection>
                </form>
              </div>
            ) : (
              <>
                <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={sellQuery}
                      onChange={(e) => setSellQuery(e.target.value)}
                      placeholder="Search Amazon, Apple, Steam…"
                      className="h-12 w-full rounded-2xl border border-border bg-background pr-4 pl-10 text-sm outline-none focus:border-primary"
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
                          : `${filteredSell.length} brands · tap to redeem`}
                      </p>
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
                            <div className="h-11 w-11 animate-pulse rounded-2xl bg-muted" />
                            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                          </div>
                        ))
                      : filteredSell.map((brand, index) => {
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
                              }}
                              whileTap={{ scale: 0.992 }}
                              onClick={() => setSelectedSell(brand)}
                              className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                            >
                              <BrandLogo
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
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="buy-root"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-4 sm:space-y-5"
          >
            {buySuccess ? (
              <MotionSection>
                <div className="rounded-2xl border border-border bg-background p-5 text-center shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8">
                  <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                    <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
                  </span>
                  <h2 className="mt-4 text-xl font-bold">Gift card purchased</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Charged {buyReceiptAmount}
                    {selectedBuy ? ` · ${selectedBuy.brandName}` : ""}
                  </p>

                  {buyCards.length ? (
                    <div className="mt-5 space-y-2 text-left">
                      {buyCards.map((card, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-border bg-muted/40 p-4"
                        >
                          {card.cardNumber ? (
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">
                                  Code
                                </p>
                                <p className="font-mono text-sm font-semibold break-all">
                                  {card.cardNumber}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="rounded-xl bg-background p-2"
                                onClick={() =>
                                  copyText(String(card.cardNumber))
                                }
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                          {card.pinCode ? (
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[11px] text-muted-foreground">
                                  PIN
                                </p>
                                <p className="font-mono text-sm font-semibold">
                                  {card.pinCode}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="rounded-xl bg-background p-2"
                                onClick={() => copyText(String(card.pinCode))}
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Code will also be emailed if provided by the issuer.
                    </p>
                  )}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                    {buyTxId ? (
                      <Link
                        href={`/history/${buyTxId}`}
                        className="btn-primary inline-flex h-12 items-center justify-center px-6"
                      >
                        View receipt
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="btn-secondary h-12 px-6"
                      onClick={() => {
                        setBuySuccess(false);
                        setSelectedBuy(null);
                      }}
                    >
                      Buy another
                    </button>
                  </div>
                </div>
              </MotionSection>
            ) : selectedBuy ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setSelectedBuy(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All products
                </button>

                <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      brand={{
                        image: selectedBuy.image,
                        name: selectedBuy.brandName,
                      }}
                      fallbacks={selectedBuy.imageFallbacks}
                      size={56}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold">
                        Buy {selectedBuy.brandName}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedBuy.name}
                        {buyDemo ? " · demo" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeBuyQuery("");
                        setChangeBuyOpen(true);
                      }}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition hover:border-primary/40 hover:bg-oryno-orange-muted hover:text-primary"
                      aria-label="Change gift card"
                      title="Change gift card"
                    >
                      <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                  {selectedBuy.redeemHint ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {selectedBuy.redeemHint}
                    </p>
                  ) : null}
                </MotionSection>

                <form onSubmit={onBuySubmit} className="space-y-4">
                  <MotionSection
                    delay={0.04}
                    className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
                  >
                    <p className="text-xs font-semibold text-muted-foreground">
                      Amount ({selectedBuy.recipientCurrency})
                    </p>
                    {selectedBuy.denominationType === "FIXED" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedBuy.denominations.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setBuyAmount(String(d))}
                            className={cn(
                              "rounded-full px-3.5 py-1.5 text-xs font-semibold",
                              Number(buyAmount) === d
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {selectedBuy.recipientCurrency} {d}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <input
                      type="number"
                      min={selectedBuy.minAmount ?? 1}
                      max={selectedBuy.maxAmount ?? undefined}
                      step="0.01"
                      value={buyAmount}
                      onChange={(e) => setBuyAmount(e.target.value)}
                      className="mt-3 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                      required
                    />

                    <label className="mt-4 block text-xs font-semibold text-muted-foreground">
                      Delivery email
                      <input
                        type="email"
                        value={buyEmail}
                        onChange={(e) => setBuyEmail(e.target.value)}
                        placeholder="you@email.com"
                        required
                        className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                      />
                    </label>
                  </MotionSection>

                  <MotionSection
                    delay={0.08}
                    className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">You pay</span>
                      <span className="inline-flex items-center gap-1.5 font-bold">
                        <Wallet className="h-4 w-4 text-primary" />
                        {buyQuoting
                          ? "…"
                          : buyQuote
                            ? `${buyQuote.currency === "NGN" ? "₦" : `${buyQuote.currency} `}${buyQuote.local.toLocaleString("en-NG", {
                                minimumFractionDigits: 2,
                              })}`
                            : "—"}
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={buySubmitting || !buyQuote || !buyEmail.trim()}
                      className="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {buySubmitting ? "Buying…" : "Buy gift card"}
                    </button>
                  </MotionSection>
                </form>
              </div>
            ) : (
              <>
                <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                  <label className="mb-3 block text-xs font-semibold text-muted-foreground">
                    Card country
                    <select
                      value={buyCountry}
                      onChange={(e) => setBuyCountry(e.target.value)}
                      className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      {BUY_COUNTRIES.map((c) => (
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
                      className="h-12 w-full rounded-2xl border border-border bg-background pr-4 pl-10 text-sm outline-none focus:border-primary"
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
                        {buyDemo ? " · demo catalog" : ""}
                      </p>
                    </div>
                    <ShoppingBag className="h-5 w-5 text-primary" />
                  </div>
                  <div className="divide-y divide-border">
                    {buyLoading
                      ? Array.from({ length: 6 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex h-[72px] items-center gap-3 px-4"
                          >
                            <div className="h-11 w-11 animate-pulse rounded-2xl bg-muted" />
                            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                          </div>
                        ))
                      : filteredBuy.map((product, index) => {
                          const from =
                            product.denominations[0] ??
                            product.minAmount ??
                            10;
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
                              onClick={() => setSelectedBuy(product)}
                              className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                            >
                              <BrandLogo
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
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedSell && !selectedBuy && !sellSuccess && !buySuccess ? (
        <ServiceInstructions
          service="gift-cards"
          className="mt-5"
          delay={0.1}
        />
      ) : null}

      <ChangeCardSheet
        open={changeSellOpen}
        onOpenChange={setChangeSellOpen}
        isMobile={isMobile}
        title="Change gift card"
        description="Pick another brand to sell without leaving this form."
        search={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={changeSellQuery}
              onChange={(e) => setChangeSellQuery(e.target.value)}
              placeholder="Search brands…"
              className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
        }
      >
        {changeSellOptions.length ? (
          changeSellOptions.map((brand) => {
            const active = selectedSell?.slug === brand.slug;
            const rate = rateMap[brand.slug];
            return (
              <button
                key={brand.slug}
                type="button"
                onClick={() => {
                  setSelectedSell(brand);
                  setImages([]);
                  setCode("");
                  setChangeSellOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50",
                  active && "bg-oryno-orange-muted",
                )}
              >
                <BrandLogo
                  brand={{
                    slug: brand.slug,
                    image: brand.image,
                    name: brand.name,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{brand.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {brand.category}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums">
                  {rate != null ? `₦${rate.toLocaleString("en-NG")}` : "—"}
                </p>
              </button>
            );
          })
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No brands match your search
          </p>
        )}
      </ChangeCardSheet>

      <ChangeCardSheet
        open={changeBuyOpen}
        onOpenChange={setChangeBuyOpen}
        isMobile={isMobile}
        title="Change gift card"
        description="Pick another product to buy without leaving this form."
        search={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={changeBuyQuery}
              onChange={(e) => setChangeBuyQuery(e.target.value)}
              placeholder="Search products…"
              className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
              autoFocus
            />
          </div>
        }
      >
        {changeBuyOptions.length ? (
          changeBuyOptions.map((product) => {
            const active = selectedBuy?.productId === product.productId;
            return (
              <button
                key={product.productId}
                type="button"
                onClick={() => {
                  setSelectedBuy(product);
                  setChangeBuyOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50",
                  active && "bg-oryno-orange-muted",
                )}
              >
                <BrandLogo
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
                <p className="shrink-0 text-[10px] font-medium text-muted-foreground">
                  {product.countryCode}
                </p>
              </button>
            );
          })
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No products match your search
          </p>
        )}
      </ChangeCardSheet>
    </AppShell>
  );
}

function ChangeCardSheet({
  open,
  onOpenChange,
  isMobile,
  title,
  description,
  search,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  title: string;
  description: string;
  search: React.ReactNode;
  children: React.ReactNode;
}) {
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[88vh] flex-col rounded-t-[28px] border-border pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <DrawerHeader className="gap-1 border-b border-border px-5 pb-3 pt-2 text-left">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="shrink-0 border-b border-border px-4 py-3">
            {search}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden rounded-[24px] p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="border-b border-border px-4 py-3">{search}</div>
        <div className="max-h-[50vh] overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
