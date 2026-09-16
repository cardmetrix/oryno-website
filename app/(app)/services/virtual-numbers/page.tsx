"use client";

import {
  FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Globe2,
  Phone,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
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
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { formatUsd } from "@/lib/country";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type HeroService = { code: string; name: string };
type HeroOffer = {
  countryId: number;
  countrySlug?: string;
  countryName: string;
  iso: string | null;
  flagUrl: string | null;
  flagEmoji: string;
  service: string;
  serviceName: string;
  operator?: string;
  costUsd?: number;
  priceUsd: number;
  priceLocal: number;
  currency: string;
  count: number;
};

export default function VirtualNumbersPage() {
  const isMobile = useIsMobile();
  const { canAffordUsd, frozen } = useWalletBalance();
  const [services, setServices] = useState<HeroService[]>([]);
  const [service, setService] = useState("whatsapp");
  const [offers, setOffers] = useState<HeroOffer[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(false);

  const [countryOpen, setCountryOpen] = useState(false);
  const [serviceQuery, setServiceQuery] = useState("");
  const [countryQuery, setCountryQuery] = useState("");

  const [selected, setSelected] = useState<HeroOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canBuyNumber = Boolean(
    selected &&
      !submitting &&
      !frozen &&
      canAffordUsd(selected.priceUsd),
  );
  const buyLabel = submitting
    ? "Getting number…"
    : frozen
      ? "Wallet unavailable"
      : selected && !canAffordUsd(selected.priceUsd)
        ? "Insufficient USD balance"
        : selected
          ? `Get number · ${formatUsd(selected.priceUsd)}`
          : "Select a country";

  const [success, setSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activationId, setActivationId] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [orderPending, setOrderPending] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [services, serviceQuery]);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.countryName.toLowerCase().includes(q) ||
        (o.iso || "").toLowerCase().includes(q),
    );
  }, [offers, countryQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/services/numbers/services");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        setServices(data.services ?? []);
        if (data.services?.[0]?.code) setService(data.services[0].code);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load services");
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!service) return;
    let cancelled = false;
    (async () => {
      setLoadingOffers(true);
      setSelected(null);
      setCountryQuery("");
      setCountryOpen(false);
      setError(null);
      try {
        const res = await fetch(
          `/api/services/numbers/prices?service=${encodeURIComponent(service)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        const list: HeroOffer[] = data.offers ?? [];
        setOffers(list);
        if (list[0]) setSelected(list[0]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load prices");
          setOffers([]);
        }
      } finally {
        if (!cancelled) setLoadingOffers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [service]);

  useEffect(() => {
    if (!success || !activationId || smsCode || reversed) return;
    let cancelled = false;
    const started = Date.now();
    const maxMs = 60 * 60 * 1000;

    async function tick() {
      if (cancelled) return;
      if (Date.now() - started > maxMs) {
        setPolling(false);
        return;
      }
      setPolling(true);
      try {
        const res = await fetch(
          `/api/services/numbers/status/${encodeURIComponent(activationId)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (data.code) {
          setSmsCode(data.code);
          setOrderPending(false);
          setPolling(false);
          return;
        }
        if (data.refunded || data.status === "STATUS_CANCEL") {
          setReversed(true);
          setOrderPending(false);
          setPolling(false);
          toast.error(
            data.error ||
              "No SMS arrived in time. This purchase was reversed to your USD wallet.",
          );
          return;
        }
        if (typeof data.expiresAt === "string") {
          setExpiresAt(data.expiresAt);
        }
      } catch {
        // keep polling
      }
      setPolling(false);
      window.setTimeout(tick, 8000);
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [success, activationId, smsCode, reversed]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected || submitting || !canBuyNumber) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/services/numbers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroCountryId: selected.countryId,
          countrySlug: selected.countrySlug,
          countryName: selected.countryName,
          iso: selected.iso,
          service: selected.service,
          serviceName: selected.serviceName,
          operator: selected.operator,
          costUsd: selected.costUsd ?? selected.priceUsd,
          priceUsd: selected.priceUsd,
          priceLocal: selected.priceLocal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setPhoneNumber(data.phoneNumber);
      setActivationId(data.activationId);
      setTransactionId(data.transactionId || "");
      setReceipt(data.amountFormatted);
      setSmsCode(null);
      setOrderPending(true);
      setReversed(false);
      setExpiresAt(data.expiresAt || null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  const money = (n: number) => formatUsd(n);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Virtual Numbers"
        subtitle="Get verification numbers worldwide · billed in USD"
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <ServiceSuccess
              variant={
                reversed ? "pending" : smsCode ? "success" : "pending"
              }
              title={
                reversed
                  ? "Purchase reversed"
                  : smsCode
                    ? "Code received!"
                    : "Number ready — pending SMS"
              }
              subtitle={
                reversed
                  ? "No SMS arrived in time. Your USD wallet was refunded."
                  : smsCode
                    ? "Use this number and code for verification."
                    : "Waiting for the OTP. If it doesn’t arrive within 1 hour, you’ll be refunded automatically."
              }
              amountLabel="Amount charged"
              amount={receipt}
              onDismiss={() => setSuccess(false)}
              primaryAction={
                transactionId
                  ? {
                      label: "View in History",
                      href: `/history/${transactionId}`,
                      icon: "receipt",
                    }
                  : undefined
              }
              secondaryAction={{
                label: "Back to Home",
                href: "/dashboard",
                icon: "home",
              }}
              tertiaryAction={{
                label: "Get another number",
                onClick: () => {
                  setSuccess(false);
                  setPhoneNumber("");
                  setActivationId("");
                  setTransactionId("");
                  setSmsCode(null);
                  setOrderPending(true);
                  setReversed(false);
                  setExpiresAt(null);
                },
                icon: "plus",
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 rounded-[14px] bg-muted/50 px-3.5 py-2.5 text-xs font-semibold">
                  <span className="text-muted-foreground">Status</span>
                  <span
                    className={
                      reversed
                        ? "text-destructive"
                        : smsCode
                          ? "text-[var(--oryno-success)]"
                          : "text-primary"
                    }
                  >
                    {reversed
                      ? "Reversed"
                      : smsCode
                        ? "Completed"
                        : "Pending SMS"}
                  </span>
                </div>
                <CopyRow label="Phone number" value={phoneNumber} />
                <CopyRow
                  label="SMS code"
                  value={
                    smsCode ||
                    (reversed
                      ? "—"
                      : polling || orderPending
                        ? "Waiting for SMS…"
                        : "—")
                  }
                  mono={!smsCode}
                  copyable={Boolean(smsCode)}
                />
                {!smsCode && !reversed ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Waiting for the OTP
                    {expiresAt
                      ? ` · refunds after ${new Date(expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : " · auto-refund in 1 hour if no code"}
                  </p>
                ) : null}
              </div>
            </ServiceSuccess>
          </MotionSection>
        ) : (
          <form
            key="form"
            onSubmit={onSubmit}
            className="space-y-4 sm:space-y-5"
          >
            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <Phone className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">Select service</h2>
                  <p className="text-xs text-muted-foreground">
                    WhatsApp, Telegram, Google, Instagram & more
                  </p>
                </div>
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={serviceQuery}
                  onChange={(e) => setServiceQuery(e.target.value)}
                  placeholder="Search services (e.g. WhatsApp, Telegram)"
                  className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {loadingServices
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-muted"
                      />
                    ))
                  : filteredServices.length
                    ? filteredServices.map((s) => (
                        <button
                          key={s.code}
                          type="button"
                          onClick={() => setService(s.code)}
                          className={cn(
                            "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold",
                            service === s.code
                              ? "bg-primary text-white"
                              : "bg-muted text-foreground",
                          )}
                        >
                          {s.name}
                        </button>
                      ))
                    : (
                        <p className="py-2 text-sm text-muted-foreground">
                          No services match “{serviceQuery.trim()}”
                        </p>
                      )}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.05}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="mb-1 text-base font-semibold">Select country</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {loadingOffers
                  ? "Loading countries…"
                  : `${offers.length} countries available`}
              </p>

              {loadingOffers ? (
                <div className="h-12 animate-pulse rounded-[14px] bg-muted" />
              ) : (
                <button
                  type="button"
                  disabled={!offers.length}
                  onClick={() => {
                    setCountryQuery("");
                    setCountryOpen(true);
                  }}
                  className="flex h-12 w-full items-center gap-2 rounded-[14px] border border-border bg-background px-3.5 text-left outline-none transition hover:bg-muted/40 focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selected?.flagUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selected.flagUrl}
                      alt=""
                      className="h-5 w-7 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <Globe2 className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-semibold",
                      selected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {selected
                      ? selected.countryName
                      : offers.length
                        ? "Select a country"
                        : "No countries in stock"}
                  </span>
                  {selected ? (
                    <span className="shrink-0 text-sm font-bold text-primary">
                      {money(selected.priceUsd)}
                    </span>
                  ) : null}
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              )}

              {!loadingOffers && !offers.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  No countries in stock for this service. Try another service.
                </p>
              ) : null}

              <SearchPickerSheet
                open={countryOpen}
                onOpenChange={setCountryOpen}
                isMobile={isMobile}
                title="Select country"
                description="Search and choose a country for your number"
                searchPlaceholder="Search countries…"
                query={countryQuery}
                onQueryChange={setCountryQuery}
                emptyLabel={
                  countryQuery.trim()
                    ? "No countries match your search"
                    : "No countries available for this service"
                }
                hasItems={filteredCountries.length > 0}
              >
                {filteredCountries.map((offer) => {
                  const active =
                    selected?.countryId === offer.countryId &&
                    selected?.service === offer.service;
                  return (
                    <button
                      key={`${offer.countryId}-${offer.service}`}
                      type="button"
                      onClick={() => {
                        setSelected(offer);
                        setCountryOpen(false);
                        setCountryQuery("");
                      }}
                      className={cn(
                        "flex min-h-[56px] w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/70 hover:bg-muted/50",
                        active && "bg-oryno-orange-muted",
                      )}
                    >
                      {offer.flagUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={offer.flagUrl}
                          alt={offer.countryName}
                          className="h-7 w-9 shrink-0 rounded object-cover shadow-sm"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xl">{offer.flagEmoji}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {offer.countryName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {offer.count.toLocaleString()} available · SMS
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                        {money(offer.priceUsd)}
                      </span>
                      {active ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-primary"
                          strokeWidth={2.25}
                        />
                      ) : (
                        <span className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </SearchPickerSheet>
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Service" value={selected?.serviceName ?? "—"} />
                <Row
                  label="Country"
                  value={
                    selected
                      ? `${selected.flagEmoji} ${selected.countryName}`
                      : "—"
                  }
                />
                <Row
                  label="Amount"
                  value={selected ? money(selected.priceUsd) : money(0)}
                  accent
                />
                <div className="flex items-center gap-2 border-t border-border pt-3 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  Pay from USD card
                </div>
              </div>
            </MotionSection>

            <div className="hidden pt-2 sm:block">
              <motion.button
                type="submit"
                disabled={!canBuyNumber}
                whileTap={canBuyNumber ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
              >
                {buyLabel}
              </motion.button>
            </div>

            <div
              aria-hidden
              className="h-[calc(1.5rem+5.5rem+env(safe-area-inset-bottom))] sm:hidden"
            />

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[image:var(--header-surface)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
              <button
                type="submit"
                disabled={!canBuyNumber}
                className="btn-primary h-12 w-full text-base disabled:opacity-50"
              >
                {buyLabel}
              </button>
            </div>
          </form>
        )}
      </AnimatePresence>

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Virtual Numbers"
      />
    </AppShell>
  );
}

function SearchPickerSheet({
  open,
  onOpenChange,
  isMobile,
  title,
  description,
  searchPlaceholder,
  query,
  onQueryChange,
  emptyLabel,
  hasItems,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  title: string;
  description: string;
  searchPlaceholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  emptyLabel: string;
  hasItems: boolean;
  children: ReactNode;
}) {
  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-base outline-none focus:border-primary"
        autoFocus
      />
    </div>
  );

  const list = hasItems ? (
    children
  ) : (
    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
      {emptyLabel}
    </p>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        shouldScaleBackground={false}
        repositionInputs={false}
        handleOnly
      >
        <DrawerContent className="h-[min(78dvh,640px)] max-h-[78dvh] w-full max-w-full rounded-t-[28px] border-border sm:mx-auto sm:max-w-lg">
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
            <div className="pb-4">{list}</div>
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
        <div className="max-h-[50vh] overflow-y-auto">{list}</div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[60%] text-right font-semibold break-words",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CopyRow({
  label,
  value,
  mono,
  copyable = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
  /** When false, hide the copy control (e.g. waiting placeholder). */
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const canCopy =
    copyable &&
    Boolean(value?.trim()) &&
    value !== "—" &&
    !/waiting/i.test(value);

  async function onCopy() {
    if (!canCopy) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(`Couldn’t copy ${label.toLowerCase()}`);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-sm font-bold tabular-nums text-foreground",
            mono && "font-mono tracking-wide text-muted-foreground",
            canCopy && "font-mono tracking-wide text-foreground",
          )}
        >
          {value}
        </p>
      </div>
      {canCopy ? (
        <button
          type="button"
          onClick={() => void onCopy()}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] border border-border bg-background px-3 text-xs font-semibold transition",
            copied
              ? "border-[var(--oryno-success)]/40 text-[var(--oryno-success)]"
              : "text-foreground hover:bg-muted",
          )}
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <Check className="h-4 w-4" strokeWidth={2.25} />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={2} />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      ) : null}
    </div>
  );
}
