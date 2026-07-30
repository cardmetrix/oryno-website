"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Link2,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { ServiceInstructions } from "@/components/app/service-instructions";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
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

const selectClassName = cn(authInputClassName, "appearance-none pr-10");

export default function SocialBoostPage() {
  const { country } = useCountry();
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platform, setPlatform] = useState("");
  const [metric, setMetric] = useState("");
  const [services, setServices] = useState<JapServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState(1000);
  const [profileUrl, setProfileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // Load the full catalog once — platform/type/package filter client-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/jap/services");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load services");
        if (cancelled) return;

        const nextPlatforms: string[] = (data.platforms ?? []).filter(
          (p: string) => p && p !== "All",
        );
        const list: JapServiceRow[] = data.services ?? [];
        setPlatforms(nextPlatforms);
        setServices(list);

        const firstPlatform =
          nextPlatforms.find((p) => list.some((s) => s.platform === p)) ||
          nextPlatforms[0] ||
          "";
        setPlatform(firstPlatform);

        const firstMetric =
          list.find((s) => s.platform === firstPlatform)?.metric ||
          list[0]?.metric ||
          "";
        setMetric(firstMetric);

        const firstPkg =
          list.find(
            (s) =>
              s.platform === firstPlatform && s.metric === firstMetric,
          ) ?? list[0] ?? null;
        setSelectedId(firstPkg?.service ?? null);
        if (firstPkg) {
          setQuantity(
            clampQty(firstPkg.sampleQuantity, firstPkg.min, firstPkg.max),
          );
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
  }, []);

  const metrics = useMemo(() => {
    const set = new Set(
      services
        .filter((s) => !platform || s.platform === platform)
        .map((s) => s.metric)
        .filter(Boolean),
    );
    return Array.from(set);
  }, [services, platform]);

  const packagesForType = useMemo(() => {
    return services.filter(
      (s) =>
        (!platform || s.platform === platform) &&
        (!metric || s.metric === metric),
    );
  }, [services, platform, metric]);

  const selected =
    packagesForType.find((s) => s.service === selectedId) ??
    packagesForType[0] ??
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
    setSelectedId(selected.service);
    setQuantity((q) => clampQty(q, selected.min, selected.max));
  }, [selected]);

  // Keep metric valid when platform changes (instant, no network).
  useEffect(() => {
    if (!platform || !metrics.length) return;
    if (!metrics.includes(metric)) {
      setMetric(metrics[0]);
    }
  }, [platform, metrics, metric]);

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

  function onPlatformChange(next: string) {
    setPlatform(next);
    const nextMetrics = Array.from(
      new Set(
        services
          .filter((s) => s.platform === next)
          .map((s) => s.metric)
          .filter(Boolean),
      ),
    );
    const nextMetric = nextMetrics[0] || "";
    setMetric(nextMetric);
    const match = services.find(
      (s) => s.platform === next && s.metric === nextMetric,
    );
    setSelectedId(match?.service ?? null);
    if (match) {
      setQuantity(clampQty(match.sampleQuantity, match.min, match.max));
    }
  }

  function onMetricChange(next: string) {
    setMetric(next);
    const match = services.find(
      (s) =>
        (!platform || s.platform === platform) && s.metric === next,
    );
    setSelectedId(match?.service ?? null);
    if (match) {
      setQuantity(clampQty(match.sampleQuantity, match.min, match.max));
    }
  }

  function onPackageChange(serviceId: number) {
    const match = packagesForType.find((s) => s.service === serviceId);
    setSelectedId(serviceId);
    if (match) {
      setQuantity(clampQty(match.sampleQuantity, match.min, match.max));
    }
  }

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
        subtitle="Grow followers, likes, views"
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
                    Choose boost
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Pick a platform, then the type of boost
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <AuthField label="Platform">
                  <div className="relative">
                    <select
                      value={platform}
                      onChange={(e) => onPlatformChange(e.target.value)}
                      disabled={!platforms.length}
                      className={selectClassName}
                    >
                      {!platform ? (
                        <option value="">
                          {loading ? "Loading…" : "Select platform"}
                        </option>
                      ) : null}
                      {platforms.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </AuthField>

                <AuthField label="Type of service">
                  <div className="relative">
                    <select
                      value={metric}
                      onChange={(e) => onMetricChange(e.target.value)}
                      disabled={!metrics.length}
                      className={selectClassName}
                    >
                      {!metric ? (
                        <option value="">
                          {loading ? "Loading…" : "Select type"}
                        </option>
                      ) : null}
                      {metrics.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </AuthField>

                <AuthField label="Package">
                  <div className="relative">
                    <select
                      value={selected?.service ?? ""}
                      onChange={(e) =>
                        onPackageChange(Number(e.target.value))
                      }
                      disabled={!packagesForType.length}
                      className={selectClassName}
                    >
                      {!selected ? (
                        <option value="">
                          {loading ? "Loading…" : "Select package"}
                        </option>
                      ) : null}
                      {packagesForType.map((item) => (
                        <option key={item.service} value={item.service}>
                          {item.name} · {money(item.samplePriceLocal)}/
                          {item.sampleQuantity.toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </AuthField>

                {selected ? (
                  <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {selected.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Min {selected.min.toLocaleString()} · Max{" "}
                          {selected.max.toLocaleString()}
                          {selected.refill ? " · Refill available" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-sm font-bold text-foreground">
                        {money(selected.samplePriceLocal)}
                        <span className="block text-[10px] font-medium text-muted-foreground">
                          / {selected.sampleQuantity.toLocaleString()}
                        </span>
                      </p>
                    </div>
                  </div>
                ) : null}
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
              delay={0.08}
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
                  label="Type"
                  value={selected?.metric ?? "—"}
                />
                <SummaryRow
                  label="Package"
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
                    Pay from wallet
                  </span>
                </div>
              </div>
            </MotionSection>

            <ServiceInstructions service="social" delay={0.1} />

            <MotionSection delay={0.14}>
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

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Social Boost"
      />
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
