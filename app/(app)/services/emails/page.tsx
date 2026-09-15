"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Copy,
  Globe2,
  Mail,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
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
import { FIVESIM_EMAIL_SERVICES } from "@/lib/fivesim/catalog";
import { cn } from "@/lib/utils";

type EmailOffer = {
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

const EMAIL_SERVICES = FIVESIM_EMAIL_SERVICES;

export default function EmailRentPage() {
  const isMobile = useIsMobile();
  const { canAffordUsd, frozen } = useWalletBalance();
  const [service, setService] = useState(EMAIL_SERVICES[0]?.code || "google");
  const [offers, setOffers] = useState<EmailOffer[]>([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");
  const [selected, setSelected] = useState<EmailOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activationId, setActivationId] = useState("");
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const serviceName =
    EMAIL_SERVICES.find((s) => s.code === service)?.name || service;

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.countryName.toLowerCase().includes(q) ||
        (o.iso || "").toLowerCase().includes(q),
    );
  }, [offers, countryQuery]);

  const canSubmit = Boolean(
    selected && !submitting && !frozen && canAffordUsd(selected.priceUsd),
  );

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
        if (!res.ok) throw new Error(data.error || "Failed to load prices");
        if (cancelled) return;
        const list = (data.offers ?? []) as EmailOffer[];
        setOffers(list);
        if (list[0]) setSelected(list[0]);
      } catch (e) {
        if (!cancelled) {
          setOffers([]);
          setError(e instanceof Error ? e.message : "Failed to load prices");
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
    if (!success || !activationId || smsCode) return;
    let cancelled = false;
    let tries = 0;

    async function tick() {
      if (cancelled || tries > 40) return;
      tries += 1;
      setPolling(true);
      try {
        const res = await fetch(
          `/api/services/emails/status/${encodeURIComponent(activationId)}`,
        );
        const data = await res.json();
        if (data.code) {
          setSmsCode(String(data.code));
          setPolling(false);
          return;
        }
      } catch {
        // keep polling
      }
      setPolling(false);
      window.setTimeout(tick, 5000);
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [success, activationId, smsCode]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/services/emails/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroCountryId: selected.countryId,
          countrySlug: selected.countrySlug,
          countryName: selected.countryName,
          iso: selected.iso,
          service: selected.service,
          serviceName: selected.serviceName,
          costUsd: selected.costUsd ?? selected.priceUsd,
          priceUsd: selected.priceUsd,
          priceLocal: selected.priceLocal,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("[rent-email] purchase failed", {
          status: res.status,
          code: data.code,
          error: data.error,
        });
        throw new Error(data.error || "Purchase failed");
      }
      setPhoneNumber(data.phoneNumber);
      setActivationId(data.activationId);
      setReceipt(data.amountFormatted);
      setSmsCode(null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel() {
    if (!activationId || smsCode || cancelling) return;
    setCancelling(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/services/emails/status/${encodeURIComponent(activationId)}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not cancel number");
      setSuccess(false);
      setPhoneNumber("");
      setActivationId("");
      setSmsCode(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel number");
    } finally {
      setCancelling(false);
    }
  }

  const money = (n: number) => formatUsd(n);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Rent Email"
        subtitle="SMS numbers for Gmail, Hotmail & more · 5sim · billed in USD"
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <ServiceSuccess
              title="Number ready!"
              subtitle={`Use this number for ${serviceName} signup OTP.`}
              amountLabel="Amount charged"
              amount={receipt}
              onDismiss={() => setSuccess(false)}
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
                  setSmsCode(null);
                },
                icon: "plus",
              }}
            >
              <div className="space-y-3">
                <CopyRow label="Phone number" value={phoneNumber} />
                <CopyRow
                  label="SMS code"
                  value={smsCode || (polling ? "Waiting for SMS…" : "—")}
                  mono={!smsCode}
                />
                {polling && !smsCode ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Waiting for verification SMS…
                  </p>
                ) : null}
                {!smsCode ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={cancelling}
                    className="h-10 w-full rounded-xl border border-border text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {cancelling ? "Cancelling…" : "Cancel this number"}
                  </button>
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
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Email service</h2>
                  <p className="text-xs text-muted-foreground">
                    Get an SMS number for mailbox signup
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {EMAIL_SERVICES.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onClick={() => setService(s.code)}
                    className={cn(
                      "rounded-full px-3.5 py-2 text-sm font-semibold",
                      service === s.code
                        ? "bg-primary text-white"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.05}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="mb-1 text-base font-semibold">Country</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Pick a market with stock for {serviceName}
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
                      className="h-4 w-6 rounded-sm object-cover"
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
                        : "No stock right now"}
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
                  No numbers in stock for {serviceName}. Try another service.
                </p>
              ) : null}

              <CountryPickerSheet
                open={countryOpen}
                onOpenChange={setCountryOpen}
                isMobile={isMobile}
                query={countryQuery}
                onQueryChange={setCountryQuery}
                options={filteredCountries}
                value={selected?.countryId ?? null}
                formatPrice={money}
                onSelect={(offer) => {
                  setSelected(offer);
                  setCountryOpen(false);
                  setCountryQuery("");
                }}
              />
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Service" value={serviceName} />
                <Row
                  label="Country"
                  value={selected?.countryName || "—"}
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

            <div className="hidden pt-4 sm:block">
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileTap={canSubmit ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full max-w-md text-base disabled:opacity-50"
              >
                {submitting
                  ? "Getting number…"
                  : frozen
                    ? "Wallet unavailable"
                    : selected && !canAffordUsd(selected.priceUsd)
                      ? "Insufficient USD balance"
                      : selected
                        ? `Get number · ${money(selected.priceUsd)}`
                        : "Continue"}
              </motion.button>
            </div>

            <div
              aria-hidden
              className="h-[calc(1.5rem+5.5rem+env(safe-area-inset-bottom))] sm:hidden"
            />

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-[image:var(--header-surface)] px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl sm:hidden">
              <button
                type="submit"
                disabled={!canSubmit}
                className="btn-primary h-12 w-full text-base disabled:opacity-50"
              >
                {submitting
                  ? "Getting number…"
                  : frozen
                    ? "Wallet unavailable"
                    : selected && !canAffordUsd(selected.priceUsd)
                      ? "Insufficient USD balance"
                      : selected
                        ? `Get · ${money(selected.priceUsd)}`
                        : "Continue"}
              </button>
            </div>
          </form>
        )}
      </AnimatePresence>

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Rent Email"
      />
    </AppShell>
  );
}

function CountryPickerSheet({
  open,
  onOpenChange,
  isMobile,
  query,
  onQueryChange,
  options,
  value,
  formatPrice,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMobile: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  options: EmailOffer[];
  value: number | null;
  formatPrice: (n: number) => string;
  onSelect: (offer: EmailOffer) => void;
}) {
  const search = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search countries…"
        className="h-11 w-full rounded-xl border border-border bg-background pr-3 pl-9 text-base outline-none focus:border-primary"
        autoFocus
      />
    </div>
  );

  const list = options.length ? (
    options.map((o) => {
      const active = o.countryId === value;
      return (
        <button
          key={`${o.countrySlug || o.countryId}-${o.operator || "any"}`}
          type="button"
          onClick={() => onSelect(o)}
          className={cn(
            "flex min-h-[56px] w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/70 hover:bg-muted/50",
            active && "bg-oryno-orange-muted",
          )}
        >
          {o.flagUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={o.flagUrl}
              alt=""
              className="h-4 w-6 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <span className="text-base">{o.flagEmoji || "🏳️"}</span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {o.countryName}
            </p>
            {o.count > 0 ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {o.count.toLocaleString()} in stock
              </p>
            ) : null}
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
            {formatPrice(o.priceUsd)}
          </span>
          {active ? (
            <Check className="h-4 w-4 shrink-0 text-primary" strokeWidth={2.25} />
          ) : (
            <span className="h-4 w-4 shrink-0" />
          )}
        </button>
      );
    })
  ) : (
    <p className="px-4 py-8 text-center text-sm text-muted-foreground">
      {query.trim()
        ? "No countries match your search"
        : "No countries available for this service"}
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
            <DrawerTitle className="text-base sm:text-lg">
              Select country
            </DrawerTitle>
            <DrawerDescription className="text-xs sm:text-sm">
              SMS number for email signup
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
          <DialogTitle>Select country</DialogTitle>
          <DialogDescription>
            SMS number for email signup
          </DialogDescription>
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
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] border border-border bg-muted/40 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          className={cn(
            "truncate text-sm font-bold",
            mono && "text-muted-foreground",
          )}
        >
          {value}
        </p>
      </div>
      {value && value !== "—" && !value.includes("Waiting") ? (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(value)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-border bg-background"
          aria-label="Copy"
        >
          <Copy className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
