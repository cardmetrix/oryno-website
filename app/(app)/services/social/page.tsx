"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Link2,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceInstructions } from "@/components/app/service-instructions";
import { useCountry } from "@/components/providers/country-provider";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";

type JapServiceRow = {
  service: number;
  name: string;
  type: string;
  category: string;
  platform: string;
  metric: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  currency: string;
  priceLocalPerThousand: number;
  sampleQuantity: number;
  samplePriceLocal: number;
};

function clampQty(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function priceFor(service: JapServiceRow, quantity: number) {
  return (service.priceLocalPerThousand * quantity) / 1000;
}

export default function SocialBoostPage() {
  const { country } = useCountry();
  const [platforms, setPlatforms] = useState<string[]>(["All"]);
  const [platform, setPlatform] = useState("All");
  const [services, setServices] = useState<JapServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1000);
  const [profileUrl, setProfileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (platform && platform !== "All") params.set("platform", platform);
        const res = await fetch(`/api/jap/services?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load services");
        if (cancelled) return;
        setDemo(Boolean(data.demo));
        setPlatforms(data.platforms ?? ["All"]);
        const list: JapServiceRow[] = data.services ?? [];
        setServices(list);
        if (list[0]) {
          setSelectedId((prev) =>
            list.some((s) => s.service === prev) ? prev : list[0].service,
          );
          const next = list.find((s) => s.service === selectedId) ?? list[0];
          setQuantity((q) =>
            clampQty(q || next.sampleQuantity, next.min, next.max),
          );
        } else {
          setSelectedId(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load services");
          setServices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedId preference only
  }, [platform]);

  const visibleServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.metric.toLowerCase().includes(q) ||
        s.platform.toLowerCase().includes(q) ||
        String(s.service).includes(q),
    );
  }, [services, query]);

  const selected =
    visibleServices.find((s) => s.service === selectedId) ??
    visibleServices[0] ??
    services.find((s) => s.service === selectedId) ??
    null;

  const amount = selected ? priceFor(selected, quantity) : 0;

  const canSubmit = useMemo(() => {
    if (!selected || submitting) return false;
    if (quantity < selected.min || quantity > selected.max) return false;
    const link = profileUrl.trim();
    return link.length > 4 && /^(https?:\/\/|@|t\.me\/)/i.test(link);
  }, [selected, submitting, quantity, profileUrl]);

  const money = (n: number) =>
    formatCountryMoney(n, country?.code || "NG");

  useEffect(() => {
    if (!selected) return;
    setQuantity((q) => clampQty(q, selected.min, selected.max));
  }, [selected]);

  useEffect(() => {
    if (!success || !orderId || orderId.startsWith("demo_")) return;
    let cancelled = false;
    let tries = 0;

    async function tick() {
      if (cancelled || tries > 24) return;
      tries += 1;
      setPolling(true);
      try {
        const res = await fetch(
          `/api/jap/status/${encodeURIComponent(orderId)}`,
        );
        const data = await res.json();
        if (data.data?.status) {
          setStatusLabel(String(data.data.status));
          const done = /completed|partial|canceled|cancelled|refunded/i.test(
            String(data.data.status),
          );
          if (done) {
            setPolling(false);
            return;
          }
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
  }, [success, orderId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/jap/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: selected.service,
          serviceName: selected.name,
          platform: selected.platform,
          metric: selected.metric,
          link: profileUrl.trim(),
          quantity,
          rateUsd: selected.rate,
          priceLocal: amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setOrderId(data.orderId);
      setReceipt(data.amountFormatted);
      setStatusLabel(data.simulated ? "Demo · In progress" : "Pending");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Social Boosting"
        subtitle={
          demo
            ? "Grow followers, likes, views · Demo mode"
            : "Grow followers, likes, views · JustAnotherPanel"
        }
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success && selected ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-[28px] border border-border bg-background p-8 text-center shadow-[var(--shadow-soft)]"
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-oryno-orange-muted text-primary"
              >
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} />
              </motion.span>
              <h2 className="mt-5 text-2xl font-bold text-foreground">
                Boost ordered
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {quantity.toLocaleString()} {selected.metric.toLowerCase()} for{" "}
                {selected.platform} · {receipt}
              </p>
              {statusLabel ? (
                <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                  {polling ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Status: {statusLabel}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Order #{orderId}
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setSuccess(false);
                    setStatusLabel(null);
                  }}
                  className="btn-primary h-12 px-6"
                >
                  Boost again
                </motion.button>
                <motion.a
                  href="/dashboard"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-secondary inline-flex h-12 items-center justify-center px-6"
                >
                  Back to Home
                </motion.a>
              </div>
            </motion.div>
          </MotionSection>
        ) : (
          <form key="form" onSubmit={onSubmit} className="space-y-5">
            <MotionSection className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Choose platform
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Live services from JustAnotherPanel
                  </p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {platforms.map((item) => {
                  const active = platform === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPlatform(item)}
                      className={cn(
                        "relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                          : "bg-muted text-foreground hover:bg-oryno-orange-muted",
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.04}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Profile or post link
                </span>
                <div className="mt-2 flex h-14 items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <Link2
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <input
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder="https://instagram.com/… or @username"
                    required
                    className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Boost services
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {loading
                      ? "Loading…"
                      : `${visibleServices.length} services`}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>

              <div className="relative mb-3">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search followers, likes, views…"
                  className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary"
                  autoComplete="off"
                />
              </div>

              <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse rounded-[20px] bg-muted"
                    />
                  ))
                ) : visibleServices.length ? (
                  <AnimatePresence mode="popLayout">
                    {visibleServices.map((item, index) => {
                      const active = selected?.service === item.service;
                      return (
                        <motion.button
                          key={item.service}
                          type="button"
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ delay: Math.min(index * 0.02, 0.2), duration: 0.28 }}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => {
                            setSelectedId(item.service);
                            setQuantity(
                              clampQty(
                                item.sampleQuantity,
                                item.min,
                                item.max,
                              ),
                            );
                          }}
                          className={cn(
                            "rounded-[20px] border px-4 py-4 text-left transition-colors",
                            active
                              ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
                              : "border-border bg-background hover:bg-muted/50",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-primary">
                                  {item.platform}
                                </p>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                                  {item.metric}
                                </span>
                              </div>
                              <p className="mt-1 text-sm font-bold tracking-tight text-foreground">
                                {item.name}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Min {item.min.toLocaleString()} · Max{" "}
                                {item.max.toLocaleString()}
                                {item.refill ? " · Refill" : ""}
                              </p>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-foreground">
                              {money(item.samplePriceLocal)}
                              <span className="block text-[10px] font-medium text-muted-foreground">
                                / {item.sampleQuantity.toLocaleString()}
                              </span>
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No services match your filters
                  </p>
                )}
              </div>

              {selected ? (
                <label className="mt-4 block">
                  <span className="text-sm font-semibold text-foreground">
                    Quantity
                  </span>
                  <input
                    type="number"
                    min={selected.min}
                    max={selected.max}
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(
                        clampQty(
                          Number(e.target.value),
                          selected.min,
                          selected.max,
                        ),
                      )
                    }
                    className="mt-2 h-12 w-full rounded-[14px] border border-border bg-background px-4 text-base font-semibold outline-none focus:border-primary"
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Allowed range {selected.min.toLocaleString()}–
                    {selected.max.toLocaleString()}
                  </p>
                </label>
              ) : null}
            </MotionSection>

            <MotionSection
              delay={0.12}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <h2 className="text-base font-semibold text-foreground">
                Order summary
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow
                  label="Platform"
                  value={selected?.platform ?? "—"}
                />
                <SummaryRow
                  label="Service"
                  value={selected?.name ?? "—"}
                />
                <SummaryRow
                  label="Quantity"
                  value={
                    selected
                      ? `${quantity.toLocaleString()} ${selected.metric}`
                      : "—"
                  }
                />
                <SummaryRow label="Target" value={profileUrl || "—"} />
                <SummaryRow
                  label="Amount"
                  value={money(amount)}
                  accent
                />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    Pay from wallet · JAP
                  </span>
                </div>
              </div>
            </MotionSection>

            <ServiceInstructions service="social" delay={0.14} />

            {error ? (
              <p className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <MotionSection delay={0.18}>
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileHover={canSubmit ? { y: -2 } : undefined}
                whileTap={canSubmit ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
              >
                {submitting
                  ? "Processing…"
                  : selected
                    ? `Boost now · ${money(amount)}`
                    : "Boost now"}
              </motion.button>
            </MotionSection>
          </form>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[60%] truncate text-right font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
