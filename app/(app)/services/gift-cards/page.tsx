"use client";

import {
  ChangeEvent,
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  Copy,
  ImagePlus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { GiftCardBrandLogo } from "@/components/app/gift-card-brand-logo";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
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
import { useUser } from "@clerk/nextjs";
import { useCountry } from "@/components/providers/country-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";

const MAX_CARD_IMAGE_BYTES = 2_500_000;
const MAX_CARD_IMAGES = 5;
const COMPRESSED_CARD_IMAGE_BYTES = 400_000;

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
  { code: "US", label: "United States", currency: "USD" },
  { code: "GB", label: "United Kingdom", currency: "GBP" },
  { code: "CA", label: "Canada", currency: "CAD" },
  { code: "EU", label: "Europe", currency: "EUR" },
  { code: "AU", label: "Australia", currency: "AUD" },
];

const EU_COUNTRIES = [
  "Germany",
  "France",
  "Italy",
  "Spain",
  "Netherlands",
  "Ireland",
  "Belgium",
  "Austria",
  "Portugal",
  "Sweden",
];

const FALLBACK_BUY_COUNTRIES = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "NG", label: "Nigeria" },
  { code: "AU", label: "Australia" },
];

function currencyForCardCountry(
  countryCode: string,
  brandCurrencies?: string[],
) {
  const mapped =
    CARD_COUNTRIES.find((c) => c.code === countryCode)?.currency || "USD";
  if (!brandCurrencies?.length) return mapped;
  if (brandCurrencies.includes(mapped)) return mapped;
  return brandCurrencies[0] || mapped;
}

/** Physical sell trades always use cash receipt (no UI choice). */
const PHYSICAL_SUB_TYPE = "cash_receipt" as const;

async function compressCardImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxEdge = 1280;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to read image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let quality = 0.72;
  let blob: Blob | null = null;
  for (let i = 0; i < 5; i += 1) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
    });
    if (!blob || blob.size <= COMPRESSED_CARD_IMAGE_BYTES) break;
    quality -= 0.12;
  }
  if (!blob) throw new Error("Failed to read image");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });

  return {
    filename: (file.name || "card.jpg").replace(/\.[^.]+$/, ".jpg"),
    mime: "image/jpeg",
    base64: dataUrl.split(",")[1] || "",
    preview: dataUrl,
  };
}

function FormSkeleton() {
  return (
    <MotionSection className="space-y-4">
      <div className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 animate-pulse rounded-full bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
        <div className="space-y-3">
          <div className="h-11 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
          <div className="h-12 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    </MotionSection>
  );
}

export default function GiftCardsPage() {
  return (
    <Suspense
      fallback={
        <AppShell hideNav>
          <PageHeader
            title="Gift Cards"
            subtitle="Loading…"
            backHref="/services/gift-cards/live"
          />
          <FormSkeleton />
        </AppShell>
      }
    >
      <GiftCardsPageContent />
    </Suspense>
  );
}

function GiftCardsPageContent() {
  const router = useRouter();
  const { user } = useUser();
  const { country, formatServiceMoney } = useCountry();
  const { canAfford, frozen } = useWalletBalance();
  const formatSellRate = (ngn?: number | null) =>
    ngn != null ? formatServiceMoney(ngn) : "—";
  const formatBuyPay = (quote: BuyQuote) =>
    quote.currency === "NGN"
      ? formatServiceMoney(quote.local)
      : formatCountryMoney(quote.local, country.code);
  const searchParams = useSearchParams();
  const slugParam = searchParams.get("slug");
  const productIdParam = searchParams.get("productId");
  const modeParam = searchParams.get("mode");
  const countryParam = searchParams.get("country");

  const [mode] = useState<Mode>("buy");
  const setMode = (_: Mode) => {};
  const [error, setError] = useState<string | null>(null);

  // ── Sell state ──────────────────────────────────────────────
  const [sellBrands, setSellBrands] = useState<SellBrand[]>([]);
  const [rateMap, setRateMap] = useState<Record<string, number | null>>({});
  const [sellLoading, setSellLoading] = useState(true);
  const [sellDemo, setSellDemo] = useState(false);
  const [sellUnavailable, setSellUnavailable] = useState(false);
  const [sellPartnerError, setSellPartnerError] = useState<string | null>(null);
  const [selectedSell, setSelectedSell] = useState<SellBrand | null>(null);
  const [cardType, setCardType] = useState<"ecode" | "physical">("physical");
  const [cardCountry, setCardCountry] = useState("US");
  const [specificCountry, setSpecificCountry] = useState("Germany");
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
  const [buyCountries, setBuyCountries] = useState(FALLBACK_BUY_COUNTRIES);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyDemo, setBuyDemo] = useState(false);
  const [buySandbox, setBuySandbox] = useState(false);
  const [buyCountry, setBuyCountry] = useState(
    () => (countryParam || "US").toUpperCase(),
  );
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

  useEffect(() => {
    const email = user?.primaryEmailAddress?.emailAddress?.trim();
    if (email && !buyEmail) setBuyEmail(email);
  }, [user, buyEmail]);

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
        setSellDemo(Boolean(catalog.demo));
        setSellUnavailable(
          Boolean(catalog.unavailable || ratesJson.unavailable),
        );
        setSellPartnerError(
          (typeof ratesJson.partnerError === "string" &&
            ratesJson.partnerError) ||
            (typeof catalog.partnerError === "string" &&
              catalog.partnerError) ||
            null,
        );
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

  // Load Reloadly countries for Buy tab
  useEffect(() => {
    if (mode !== "buy") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reloadly/countries");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load countries");
        if (cancelled) return;
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
        if (!cancelled) setBuyCountries(FALLBACK_BUY_COUNTRIES);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Load buy products when Buy tab active
  useEffect(() => {
    if (mode !== "buy") return;
    let cancelled = false;
    (async () => {
      setBuyLoading(true);
      try {
        const res = await fetch(
          `/api/reloadly/products?countryCode=${encodeURIComponent(buyCountry)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load products");
        if (cancelled) return;
        setBuyProducts(data.products ?? []);
        setBuyDemo(Boolean(data.demo));
        setBuySandbox(Boolean(data.sandbox));
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
    if (mode !== "sell" || sellLoading || sellBrands.length === 0) return;
    if (slugParam) {
      const match = sellBrands.find((b) => b.slug === slugParam);
      if (match) {
        setSelectedSell(match);
        return;
      }
    }
    setSelectedSell((prev) => prev ?? sellBrands[0] ?? null);
  }, [mode, sellBrands, sellLoading, slugParam]);

  // Select buy product from URL productId, else first product
  useEffect(() => {
    if (mode !== "buy" || buyLoading || buyProducts.length === 0) return;
    if (productIdParam) {
      const match = buyProducts.find(
        (p) => String(p.productId) === productIdParam,
      );
      setSelectedBuy(match ?? buyProducts[0] ?? null);
      return;
    }
    setSelectedBuy((prev) => {
      if (prev && buyProducts.some((p) => p.productId === prev.productId)) {
        return prev;
      }
      return buyProducts[0] ?? null;
    });
  }, [mode, buyProducts, buyLoading, productIdParam]);

  useEffect(() => {
    if (!selectedSell) return;
    setCardCurrency(
      currencyForCardCountry(cardCountry, selectedSell.currencies),
    );
    setCardType(
      selectedSell.cardTypes.includes("physical") ? "physical" : "ecode",
    );
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
        if (cardType === "physical") qs.set("subType", PHYSICAL_SUB_TYPE);
        const res = await fetch(`/api/sogo/rates?${qs}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to quote");
        if (!cancelled) {
          setSellQuote(data.quote ?? null);
          if (typeof data.unavailable === "boolean") {
            setSellUnavailable(Boolean(data.unavailable));
          }
          if (typeof data.demo === "boolean") {
            setSellDemo(Boolean(data.demo));
          }
          if (typeof data.partnerError === "string" && data.partnerError) {
            setSellPartnerError(data.partnerError);
          } else if (data.unavailable === false) {
            setSellPartnerError(null);
          }
        }
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
  }, [selectedSell, sellAmount, cardCurrency, cardType]);

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
      try {
        next.push(await compressCardImage(file));
      } catch {
        setError("Failed to read image");
      }
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
    if (sellDemo || sellUnavailable) {
      setError(
        sellDemo
          ? "Gift card selling is not live yet. Check Sogo credentials."
          : sellPartnerError ||
              "Live sell rates are unavailable right now. Please try again shortly.",
      );
      return;
    }
    if (cardType === "ecode" && !code.trim()) {
      setError("Enter the gift card code");
      return;
    }
    if (cardType === "physical" && images.length === 0) {
      setError("Upload at least one clear photo of the card");
      return;
    }
    if (cardCountry === "EU" && !specificCountry.trim()) {
      setError("Select the European country for this card");
      return;
    }
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
          specificCountry: cardCountry === "EU" ? specificCountry : null,
          cardType,
          subType: cardType === "physical" ? PHYSICAL_SUB_TYPE : null,
          cardCurrency,
          cardAmount: Number.parseFloat(sellAmount),
          additionalInfo: cardType === "ecode" ? code.trim() : null,
          images:
            cardType === "physical"
              ? images.map(({ filename, mime, base64 }) => ({
                  filename,
                  mime,
                  base64,
                }))
              : [],
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json().catch(() => ({}));
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
    if (buyDemo) {
      setError(
        "Gift card buying is not live yet. Check Reloadly credentials.",
      );
      return;
    }
    if (frozen || (buyQuote && !canAfford(buyQuote.local))) return;
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
          countryCode: selectedBuy.countryCode,
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

  function switchMode(tab: Mode) {
    if (tab === mode) return;
    setMode(tab);
    setSellSuccess(false);
    setBuySuccess(false);
    if (tab === "sell") {
      setSelectedBuy(null);
      setSelectedSell(sellBrands[0] ?? null);
    } else {
      setSelectedSell(null);
      setSelectedBuy(buyProducts[0] ?? null);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Gift Cards"
        subtitle="Buy digital gift cards with your USD balance"
        backHref="/services/gift-cards/live"
      />

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Gift Cards"
      />

      <MotionSection className="mb-4">
        {mode === "buy" && buyDemo ? (
          <p className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
            Buy is not live — Reloadly credentials are missing or RELOADLY_DEMO is
            on.
          </p>
        ) : null}
        {mode === "buy" && !buyDemo && buySandbox ? (
          <p className="mt-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-900 dark:text-sky-100">
            Reloadly sandbox mode — set RELOADLY_SANDBOX=false for production
            cards.
          </p>
        ) : null}
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
              <ServiceSuccess
                variant={
                  sellSuccessStatus === "completed" ? "success" : "pending"
                }
                title={
                  sellSuccessStatus === "completed"
                    ? "Trade completed!"
                    : "Trade submitted"
                }
                subtitle={
                  sellSuccessStatus === "completed"
                    ? "Your wallet has been credited successfully."
                    : "We’re reviewing your card. You’ll be notified when it’s approved."
                }
                amountLabel={
                  sellSuccessStatus === "completed"
                    ? "Amount credited"
                    : "Expected amount"
                }
                amount={sellReceiptAmount}
                reference={sellReceiptRef}
                onDismiss={() => setSellSuccess(false)}
                primaryAction={
                  sellTxId
                    ? {
                        label: "View receipt",
                        href: `/history/${sellTxId}`,
                        icon: "receipt",
                      }
                    : null
                }
                tertiaryAction={{
                  label: "Sell another gift card",
                  onClick: () => setSellSuccess(false),
                  icon: "plus",
                }}
              />
            ) : null}
            {selectedSell ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => router.push("/services/gift-cards/live")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All gift cards
                </button>

                <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                  <div className="flex items-center gap-3">
                    <GiftCardBrandLogo
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
                        {sellDemo
                          ? " · demo rates"
                          : sellUnavailable
                            ? " · indicative rates"
                            : " · live rates"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold">
                          {formatSellRate(
                            rateMap[selectedSell.slug] ??
                              sellQuote?.ratePerUnit ??
                              0,
                          )}
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
                        <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
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
                      {(
                        ["physical", "ecode"] as const
                      )
                        .filter((t) => selectedSell.cardTypes.includes(t))
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
                          {t === "physical" ? "Physical" : "E-code"}
                        </button>
                      ))}
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Card country
                        <select
                          value={cardCountry}
                          onChange={(e) => {
                            const next = e.target.value;
                            setCardCountry(next);
                            setCardCurrency(
                              currencyForCardCountry(
                                next,
                                selectedSell.currencies,
                              ),
                            );
                          }}
                          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
                        >
                          {CARD_COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Currency set to {cardCurrency}
                      </p>
                    </div>

                    {cardCountry === "EU" ? (
                      <div className="mt-4">
                        <label className="block text-xs font-semibold text-muted-foreground">
                          European country
                          <select
                            value={specificCountry}
                            onChange={(e) => setSpecificCountry(e.target.value)}
                            className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-sm"
                            required
                          >
                            {EU_COUNTRIES.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    ) : null}

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
                            {d}
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

                    {cardType === "ecode" ? (
                      <label className="mt-4 block text-xs font-semibold text-muted-foreground">
                        Gift card code
                        <input
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-4 font-mono text-sm outline-none focus:border-primary"
                          placeholder="Paste E-code"
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
                            ? formatServiceMoney(sellQuote.userPayout)
                            : "—"}
                      </span>
                    </div>
                    {sellQuote ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Provider rate {formatServiceMoney(sellQuote.ratePerUnit)}{" "}
                        per {cardCurrency} 1
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={
                        sellSubmitting ||
                        !sellQuote ||
                        sellDemo ||
                        sellUnavailable
                      }
                      className="btn-primary mt-4 flex h-12 w-full items-center justify-center disabled:opacity-60"
                    >
                      {sellSubmitting
                        ? "Submitting…"
                        : sellDemo || sellUnavailable
                          ? "Selling unavailable"
                          : "Sell gift card"}
                    </button>
                  </MotionSection>
                </form>
              </div>
            ) : (
              <FormSkeleton />
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
              <ServiceSuccess
                title="Purchase successful!"
                subtitle={
                  selectedBuy
                    ? `Your ${selectedBuy.brandName} card is ready.`
                    : "Your gift card is ready."
                }
                amountLabel="Amount charged"
                amount={buyReceiptAmount}
                onDismiss={() => setBuySuccess(false)}
                primaryAction={
                  buyTxId
                    ? {
                        label: "View receipt",
                        href: `/history/${buyTxId}`,
                        icon: "receipt",
                      }
                    : null
                }
                tertiaryAction={{
                  label: "Buy another gift card",
                  onClick: () => setBuySuccess(false),
                  icon: "plus",
                }}
              >
                {buyCards.length ? (
                  <div className="space-y-2">
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
                  <p className="text-xs text-muted-foreground">
                    Code will also be emailed if provided by the issuer.
                  </p>
                )}
              </ServiceSuccess>
            ) : null}
            {selectedBuy ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => router.push("/services/gift-cards/live")}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  All products
                </button>

                <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                  <div className="flex items-center gap-3">
                    <GiftCardBrandLogo
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
                         <ChevronDown className="h-4 w-4" strokeWidth={1.75} />
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
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Card country
                      <select
                        value={buyCountry}
                        onChange={(e) => {
                          setBuyCountry(e.target.value);
                          setSelectedBuy(null);
                          setBuyQuote(null);
                        }}
                        className="mt-1.5 h-12 w-full rounded-xl border border-border bg-background px-3 text-base sm:text-sm"
                      >
                        {buyCountries.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <p className="mt-4 text-xs font-semibold text-muted-foreground">
                      Amount ({selectedBuy.recipientCurrency})
                      {(selectedBuy.denominationType || "").toUpperCase() ===
                      "RANGE"
                        ? selectedBuy.minAmount != null &&
                          selectedBuy.maxAmount != null
                          ? ` · ${selectedBuy.minAmount}–${selectedBuy.maxAmount}`
                          : ""
                        : ""}
                    </p>
                    {(selectedBuy.denominationType || "").toUpperCase() ===
                      "FIXED" && selectedBuy.denominations.length ? (
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
                            ? formatBuyPay(buyQuote)
                            : "—"}
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={
                        buySubmitting ||
                        !buyQuote ||
                        !buyEmail.trim() ||
                        frozen ||
                        buyDemo ||
                        !canAfford(buyQuote.local)
                      }
                      className="btn-primary mt-4 flex h-12 w-full items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      {buySubmitting
                        ? "Buying…"
                        : buyDemo
                          ? "Buying unavailable"
                          : frozen
                            ? "Wallet unavailable"
                            : buyQuote && !canAfford(buyQuote.local)
                              ? "Insufficient balance"
                              : "Buy gift card"}
                    </button>
                  </MotionSection>
                </form>
              </div>
            ) : (
              <FormSkeleton />
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
              className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-base outline-none focus:border-primary"
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
                  "flex min-h-[64px] w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/70 hover:bg-muted/50",
                  active && "bg-oryno-orange-muted",
                )}
              >
                <GiftCardBrandLogo
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
                  {formatSellRate(rate)}
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
              className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-base outline-none focus:border-primary"
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
                  "flex min-h-[64px] w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/70 hover:bg-muted/50",
                  active && "bg-oryno-orange-muted",
                )}
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
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
        repositionInputs={false}
        handleOnly
      >
        <DrawerContent className="h-[min(88dvh,720px)] max-h-[88dvh] w-full max-w-full rounded-t-[28px] border-border sm:mx-auto sm:max-w-lg">
          <DrawerHeader className="shrink-0 gap-1 border-b border-border px-4 pb-3 pt-1 text-left sm:px-5">
            <DrawerTitle className="text-base sm:text-lg">{title}</DrawerTitle>
            <DrawerDescription className="text-xs sm:text-sm">
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="shrink-0 border-b border-border px-4 py-3 sm:px-5">
            {search}
          </div>
          <div
            className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
            data-vaul-no-drag=""
          >
            <div className="pb-4">{children}</div>
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
