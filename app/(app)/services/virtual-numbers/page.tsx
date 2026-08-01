"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Phone,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { ServiceInstructions } from "@/components/app/service-instructions";
import { useCountry } from "@/components/providers/country-provider";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";

type HeroService = { code: string; name: string };
type HeroOffer = {
  countryId: number;
  countryName: string;
  iso: string | null;
  flagUrl: string | null;
  flagEmoji: string;
  service: string;
  serviceName: string;
  priceUsd: number;
  priceLocal: number;
  currency: string;
  count: number;
};

export default function VirtualNumbersPage() {
  const { country } = useCountry();
  const [services, setServices] = useState<HeroService[]>([]);
  const [service, setService] = useState("wa");
  const [offers, setOffers] = useState<HeroOffer[]>([]);
  const [liveMode, setLiveMode] = useState(false);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [query, setQuery] = useState("");
  const [serviceQuery, setServiceQuery] = useState("");
  const [selected, setSelected] = useState<HeroOffer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activationId, setActivationId] = useState("");
  const [smsCode, setSmsCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [receipt, setReceipt] = useState("");

  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [services, serviceQuery]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter(
      (o) =>
        o.countryName.toLowerCase().includes(q) ||
        (o.iso || "").toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q),
    );
  }, [offers, query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/herosms/services");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        setServices(data.services ?? []);
        setLiveMode(data.demo === false);
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
      setError(null);
      setQuery("");
      try {
        const res = await fetch(
          `/api/herosms/prices?service=${encodeURIComponent(service)}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (cancelled) return;
        const list: HeroOffer[] = data.offers ?? [];
        setOffers(list);
        if (typeof data.demo === "boolean") setLiveMode(data.demo === false);
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

  // Poll SMS after purchase
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
          `/api/herosms/status/number/${encodeURIComponent(activationId)}`,
        );
        const data = await res.json();
        if (data.code) {
          setSmsCode(data.code);
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
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/herosms/purchase/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heroCountryId: selected.countryId,
          countryName: selected.countryName,
          iso: selected.iso,
          service: selected.service,
          serviceName: selected.serviceName,
          priceUsd: selected.priceUsd,
          priceLocal: selected.priceLocal,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
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

  const money = (n: number) =>
    formatCountryMoney(n, country?.code || "NG");

  return (
    <AppShell hideNav>
      <PageHeader
        title="Virtual Numbers"
        subtitle={
          liveMode
            ? "Live SMS verification numbers"
            : "SMS verification numbers"
        }
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8"
            >
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                  <CheckCircle2 className="h-7 w-7" />
                </span>
                <h2 className="mt-4 text-xl font-bold sm:text-2xl">
                  Number ready
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Use this number for verification · {receipt}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <CopyRow label="Phone number" value={phoneNumber} />
                <CopyRow
                  label="SMS code"
                  value={smsCode || (polling ? "Waiting for SMS…" : "—")}
                  mono={!smsCode}
                />
                {polling && !smsCode ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Waiting for the OTP…
                  </p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setPhoneNumber("");
                    setActivationId("");
                    setSmsCode(null);
                  }}
                  className="btn-primary h-12 w-full px-6 sm:w-auto"
                >
                  Get another number
                </button>
                <a
                  href="/dashboard"
                  className="btn-secondary inline-flex h-12 w-full items-center justify-center px-6 sm:w-auto"
                >
                  Back to Home
                </a>
              </div>
            </motion.div>
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
              <h2 className="mb-1 text-base font-semibold">Countries</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {loadingOffers
                  ? "Loading prices…"
                  : `${filtered.length} of ${offers.length} countries`}
              </p>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search country (e.g. USA, Nigeria, GB)"
                  className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
                  autoComplete="off"
                />
              </div>

              <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {loadingOffers ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-[16px] bg-muted"
                    />
                  ))
                ) : filtered.length ? (
                  filtered.map((offer) => {
                    const active =
                      selected?.countryId === offer.countryId &&
                      selected?.service === offer.service;
                    return (
                      <button
                        key={`${offer.countryId}-${offer.service}`}
                        type="button"
                        onClick={() => setSelected(offer)}
                        className={cn(
                          "flex items-center gap-3 rounded-[16px] border px-3 py-3 text-left",
                          active
                            ? "border-primary bg-oryno-orange-muted"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {offer.flagUrl ? (
                          <img
                            src={offer.flagUrl}
                            alt={offer.countryName}
                            className="h-8 w-10 shrink-0 rounded object-cover shadow-sm"
                            loading="lazy"
                          />
                        ) : (
                          <span className="text-2xl">{offer.flagEmoji}</span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">
                            {offer.countryName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {offer.count} available · SMS
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-primary">
                          {money(offer.priceLocal)}
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                    {query.trim()
                      ? `No countries match “${query.trim()}”`
                      : "No countries available for this service"}
                  </p>
                )}
              </div>
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
                  value={selected ? money(selected.priceLocal) : money(0)}
                  accent
                />
                <div className="flex items-center gap-2 border-t border-border pt-3 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  Pay from wallet
                </div>
              </div>
            </MotionSection>

            <ServiceInstructions service="virtual-numbers" delay={0.12} />

            <motion.button
              type="submit"
              disabled={!selected || submitting}
              whileTap={selected ? { scale: 0.985 } : undefined}
              className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
            >
              {submitting
                ? "Getting number…"
                : selected
                  ? `Get number · ${money(selected.priceLocal)}`
                  : "Select a country"}
            </motion.button>
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
