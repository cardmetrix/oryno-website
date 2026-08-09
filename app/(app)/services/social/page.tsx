"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
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
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatCountryMoney } from "@/lib/country";
import { isCustomCommentsService } from "@/lib/jap/catalog";
import { cn } from "@/lib/utils";

type JapServiceRow = {
  service: number;
  name: string;
  type: string;
  category: string;
  platform: string;
  metric: string;
  quality: string;
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

type BoostOption = {
  value: string;
  label: string;
  description?: string;
  trailing?: string;
};

function clampQty(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function priceFor(service: JapServiceRow, quantity: number) {
  return (service.priceLocalPerThousand * quantity) / 1000;
}

/** Global floor: users type any amount from 100 up (within package max). */
const QUANTITY_FLOOR = 100;

function parseQuantityInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

const selectClassName = cn(authInputClassName, "appearance-none pr-10");

export default function SocialBoostPage() {
  const { country } = useCountry();
  const isMobile = useIsMobile();
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [platform, setPlatform] = useState("");
  const [metric, setMetric] = useState("");
  const [quality, setQuality] = useState("");
  const [services, setServices] = useState<JapServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quantityText, setQuantityText] = useState("");
  const [customComments, setCustomComments] = useState<string[]>([""]);
  const [profileUrl, setProfileUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [receipt, setReceipt] = useState("");
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [liveMode, setLiveMode] = useState(false);

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

        setLiveMode(data.demo === false && data.fallback !== true);
        const nextPlatforms: string[] = (data.platforms ?? []).filter(
          (p: string) => p && p !== "All",
        );
        const list: JapServiceRow[] = (data.services ?? []).map(
          (s: JapServiceRow) => ({
            ...s,
            quality: s.quality || "Standard",
          }),
        );
        setPlatforms(nextPlatforms);
        setServices(list);
        if (data.fallback && !list.length) {
          setError("Boost catalog is temporarily unavailable. Try again shortly.");
        }

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

        const firstQuality =
          list.find(
            (s) =>
              s.platform === firstPlatform && s.metric === firstMetric,
          )?.quality ||
          list[0]?.quality ||
          "Standard";
        setQuality(firstQuality);

        const firstPkg =
          list.find(
            (s) =>
              s.platform === firstPlatform &&
              s.metric === firstMetric &&
              s.quality === firstQuality,
          ) ??
          list.find(
            (s) =>
              s.platform === firstPlatform && s.metric === firstMetric,
          ) ??
          list[0] ??
          null;
        setSelectedId(firstPkg?.service ?? null);
        setQuantityText("");
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

  const qualities = useMemo(() => {
    const order = [
      "Premium",
      "High Quality",
      "Instant",
      "Standard",
      "Economy",
    ];
    const set = new Set(
      services
        .filter(
          (s) =>
            (!platform || s.platform === platform) &&
            (!metric || s.metric === metric),
        )
        .map((s) => s.quality || "Standard"),
    );
    return Array.from(set).sort((a, b) => {
      const ai = order.indexOf(a);
      const bi = order.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [services, platform, metric]);

  const packagesForType = useMemo(() => {
    return services.filter(
      (s) =>
        (!platform || s.platform === platform) &&
        (!metric || s.metric === metric) &&
        (!quality || (s.quality || "Standard") === quality),
    );
  }, [services, platform, metric, quality]);

  const selected =
    packagesForType.find((s) => s.service === selectedId) ??
    packagesForType[0] ??
    null;

  const isCustomComments = selected
    ? isCustomCommentsService(selected)
    : false;
  const filledComments = useMemo(
    () => customComments.map((c) => c.trim()).filter(Boolean),
    [customComments],
  );

  const minQuantity = selected
    ? isCustomComments
      ? Math.max(1, selected.min)
      : Math.max(QUANTITY_FLOOR, selected.min)
    : QUANTITY_FLOOR;
  const maxQuantity = selected?.max ?? 1_000_000;
  const quantity = isCustomComments
    ? filledComments.length > 0
      ? filledComments.length
      : null
    : parseQuantityInput(quantityText);
  const quantityValid =
    quantity != null &&
    quantity >= minQuantity &&
    quantity <= maxQuantity;

  const amount =
    selected && quantityValid && quantity != null
      ? priceFor(selected, quantity)
      : 0;

  const quantityHint = useMemo(() => {
    if (!selected) return "Choose a package first";
    if (isCustomComments) {
      if (!filledComments.length) {
        return `Add ${minQuantity.toLocaleString()}–${maxQuantity.toLocaleString()} custom comments (one per row)`;
      }
      if (!quantityValid) {
        if (filledComments.length < minQuantity) {
          return `Add at least ${minQuantity.toLocaleString()} comments`;
        }
        return `Maximum is ${maxQuantity.toLocaleString()} comments`;
      }
      return `${filledComments.length.toLocaleString()} comments · ${formatCountryMoney(priceFor(selected, filledComments.length), country?.code || "NG")}`;
    }
    if (!quantityText.trim()) {
      return `Enter any amount from ${minQuantity.toLocaleString()}–${maxQuantity.toLocaleString()}`;
    }
    if (quantity == null) return "Enter a valid whole number";
    if (quantity < minQuantity) {
      return `Minimum is ${minQuantity.toLocaleString()}`;
    }
    if (quantity > maxQuantity) {
      return `Maximum is ${maxQuantity.toLocaleString()}`;
    }
    return `${quantity.toLocaleString()} ${selected.metric.toLowerCase()} · ${formatCountryMoney(priceFor(selected, quantity), country?.code || "NG")}`;
  }, [
    selected,
    isCustomComments,
    filledComments.length,
    quantityValid,
    quantityText,
    quantity,
    minQuantity,
    maxQuantity,
    country?.code,
  ]);

  const canSubmit = useMemo(() => {
    if (!selected || submitting || !quantityValid || quantity == null) {
      return false;
    }
    if (isCustomComments && filledComments.length !== quantity) return false;
    const link = profileUrl.trim();
    return link.length > 4 && /^(https?:\/\/|@|t\.me\/)/i.test(link);
  }, [
    selected,
    submitting,
    quantityValid,
    quantity,
    isCustomComments,
    filledComments.length,
    profileUrl,
  ]);

  const money = (n: number) =>
    formatCountryMoney(n, country?.code || "NG");

  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.service);
    if (isCustomCommentsService(selected)) {
      setCustomComments((prev) => {
        if (prev.some((c) => c.trim())) return prev;
        return [""];
      });
      setQuantityText("");
      return;
    }
    setCustomComments([""]);
    setQuantityText((prev) => {
      const n = parseQuantityInput(prev);
      if (n == null) return prev;
      if (n < Math.max(QUANTITY_FLOOR, selected.min) || n > selected.max) {
        return "";
      }
      return prev;
    });
  }, [selected]);

  // Keep metric / quality valid when upstream filters change.
  useEffect(() => {
    if (!platform || !metrics.length) return;
    if (!metrics.includes(metric)) {
      setMetric(metrics[0]);
    }
  }, [platform, metrics, metric]);

  useEffect(() => {
    if (!qualities.length) return;
    if (!qualities.includes(quality)) {
      setQuality(qualities[0]);
    }
  }, [qualities, quality]);

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
    const nextQualities = Array.from(
      new Set(
        services
          .filter(
            (s) => s.platform === next && s.metric === nextMetric,
          )
          .map((s) => s.quality || "Standard"),
      ),
    );
    const nextQuality = nextQualities[0] || "";
    setQuality(nextQuality);
    const match = services.find(
      (s) =>
        s.platform === next &&
        s.metric === nextMetric &&
        (s.quality || "Standard") === nextQuality,
    );
    setSelectedId(match?.service ?? null);
    setQuantityText("");
    setCustomComments([""]);
  }

  function onMetricChange(next: string) {
    setMetric(next);
    const nextQualities = Array.from(
      new Set(
        services
          .filter(
            (s) =>
              (!platform || s.platform === platform) && s.metric === next,
          )
          .map((s) => s.quality || "Standard"),
      ),
    );
    const nextQuality = nextQualities[0] || "";
    setQuality(nextQuality);
    const match = services.find(
      (s) =>
        (!platform || s.platform === platform) &&
        s.metric === next &&
        (s.quality || "Standard") === nextQuality,
    );
    setSelectedId(match?.service ?? null);
    setQuantityText("");
    setCustomComments([""]);
  }

  function onQualityChange(next: string) {
    setQuality(next);
    const match = services.find(
      (s) =>
        (!platform || s.platform === platform) &&
        (!metric || s.metric === metric) &&
        (s.quality || "Standard") === next,
    );
    setSelectedId(match?.service ?? null);
    setQuantityText("");
    setCustomComments([""]);
  }

  function onPackageChange(serviceId: number) {
    setSelectedId(serviceId);
    setQuantityText("");
    setCustomComments([""]);
  }

  function updateComment(index: number, value: string) {
    setCustomComments((prev) =>
      prev.map((c, i) => (i === index ? value : c)),
    );
  }

  function addCommentRow() {
    setCustomComments((prev) => {
      if (prev.length >= maxQuantity) return prev;
      return [...prev, ""];
    });
  }

  function removeCommentRow(index: number) {
    setCustomComments((prev) => {
      if (prev.length <= 1) return [""];
      return prev.filter((_, i) => i !== index);
    });
  }

  function onQuantityTextChange(raw: string) {
    // Allow digits and commas while typing
    if (raw === "" || /^[\d,.\s]*$/.test(raw)) {
      setQuantityText(raw);
    }
  }

  function nudgeQuantity(delta: number) {
    if (!selected) return;
    const current = quantity ?? minQuantity;
    const next = clampQty(current + delta, minQuantity, maxQuantity);
    setQuantityText(String(next));
  }

  function commitQuantity() {
    if (!selected) return;
    const n = parseQuantityInput(quantityText);
    if (n == null) {
      setQuantityText("");
      return;
    }
    setQuantityText(String(clampQty(n, minQuantity, maxQuantity)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected || quantity == null || !quantityValid) return;
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
          ...(isCustomComments ? { comments: filledComments } : {}),
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

  const submitLabel = submitting
    ? "Processing…"
    : selected && quantityValid && quantity != null
      ? `Boost now · ${money(amount)}`
      : isCustomComments
        ? "Add custom comments to continue"
        : "Enter quantity to continue";

  return (
    <AppShell hideNav>
      <PageHeader
        title="Social Boosting"
        subtitle={
          liveMode
            ? "Live boosts · followers, likes, views"
            : "Grow followers, likes, views"
        }
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success && selected ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border bg-background p-5 text-center shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8"
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
                {(quantity ?? 0).toLocaleString()}{" "}
                {selected.metric.toLowerCase()} for {selected.platform} ·{" "}
                {receipt}
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
                    setQuantityText("");
                    setCustomComments([""]);
                  }}
                  className="btn-primary h-12 w-full px-6 sm:w-auto"
                >
                  Boost again
                </motion.button>
                <motion.a
                  href="/dashboard"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-secondary inline-flex h-12 w-full items-center justify-center px-6 sm:w-auto"
                >
                  Back to Home
                </motion.a>
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
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Choose boost
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Platform, type, quality, then package
                  </p>
                </div>
              </div>

              <div className="space-y-3.5">
                <BoostField
                  label="Platform"
                  isMobile={isMobile}
                  value={platform}
                  placeholder={loading ? "Loading…" : "Select platform"}
                  options={platforms.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                  disabled={!platforms.length}
                  sheetTitle="Platform"
                  sheetDescription="Choose where you want to boost"
                  onChange={onPlatformChange}
                />

                <BoostField
                  label="Type of service"
                  isMobile={isMobile}
                  value={metric}
                  placeholder={loading ? "Loading…" : "Select type"}
                  options={metrics.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                  disabled={!metrics.length}
                  sheetTitle="Type of service"
                  sheetDescription="Followers, likes, views, and more"
                  onChange={onMetricChange}
                />

                <BoostField
                  label="Quality type"
                  isMobile={isMobile}
                  value={quality}
                  placeholder={
                    !metric ? "Select a type first" : "Select quality"
                  }
                  options={qualities.map((item) => ({
                    value: item,
                    label: item,
                  }))}
                  disabled={!qualities.length}
                  sheetTitle="Quality type"
                  sheetDescription="Premium, high quality, economy, and more"
                  onChange={onQualityChange}
                />

                <BoostField
                  label="Package"
                  isMobile={isMobile}
                  value={selected ? String(selected.service) : ""}
                  placeholder={loading ? "Loading…" : "Select package"}
                  options={packagesForType.map((item) => ({
                    value: String(item.service),
                    label: item.name,
                    trailing: `${money(item.samplePriceLocal)}/${item.sampleQuantity.toLocaleString()}`,
                  }))}
                  disabled={!packagesForType.length}
                  sheetTitle="Package"
                  sheetDescription="Pick a package for this boost type"
                  onChange={(next) => onPackageChange(Number(next))}
                />

                {!isCustomComments ? (
                  <div>
                    <AuthField label="Quantity">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={!selected || (quantity ?? 0) <= minQuantity}
                          onClick={() => nudgeQuantity(-100)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-border bg-muted/40 text-lg font-bold text-foreground transition hover:bg-muted disabled:opacity-40"
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9,]*"
                          value={quantityText}
                          onChange={(e) => onQuantityTextChange(e.target.value)}
                          onBlur={commitQuantity}
                          disabled={!selected}
                          placeholder={`Min ${minQuantity.toLocaleString()}`}
                          required
                          className={cn(
                            authInputClassName,
                            "text-center text-lg font-bold tabular-nums tracking-tight disabled:opacity-60",
                          )}
                          aria-invalid={
                            Boolean(quantityText.trim()) && !quantityValid
                          }
                        />
                        <button
                          type="button"
                          disabled={!selected || (quantity ?? 0) >= maxQuantity}
                          onClick={() => nudgeQuantity(100)}
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-border bg-muted/40 text-lg font-bold text-foreground transition hover:bg-muted disabled:opacity-40"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                    </AuthField>
                    <p
                      className={cn(
                        "mt-1.5 text-xs",
                        quantityText.trim() && !quantityValid
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {quantityHint}
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        Custom comments
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        {filledComments.length.toLocaleString()}/
                        {maxQuantity.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {customComments.map((comment, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-6 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <input
                            value={comment}
                            onChange={(e) =>
                              updateComment(index, e.target.value)
                            }
                            placeholder={`Comment ${index + 1}`}
                            className={cn(
                              authInputClassName,
                              "min-w-0 flex-1 text-sm font-medium",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => removeCommentRow(index)}
                            disabled={customComments.length <= 1}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] border border-border bg-muted/40 text-muted-foreground transition hover:bg-muted disabled:opacity-40"
                            aria-label={`Remove comment ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={addCommentRow}
                      disabled={customComments.length >= maxQuantity}
                      className="mt-3 inline-flex h-11 items-center gap-2 rounded-[14px] border border-border bg-muted/40 px-3 text-sm font-semibold text-foreground transition hover:bg-muted disabled:opacity-40"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} />
                      Add comment
                    </button>
                    <p
                      className={cn(
                        "mt-1.5 text-xs",
                        filledComments.length > 0 && !quantityValid
                          ? "font-medium text-destructive"
                          : "text-muted-foreground",
                      )}
                    >
                      {quantityHint}
                    </p>
                  </div>
                )}

                {selected && quantityValid && quantity != null ? (
                  <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-semibold text-foreground">
                          {selected.name}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {quantity.toLocaleString()}{" "}
                          {selected.metric.toLowerCase()}
                          {selected.refill ? " · Refill available" : ""}
                        </p>
                      </div>
                      <p className="shrink-0 text-right text-sm font-bold text-foreground">
                        {money(amount)}
                        <span className="block text-[10px] font-medium text-muted-foreground">
                          total
                        </span>
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.04}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Profile or post link
                </span>
                <div className="mt-2 flex h-14 min-w-0 items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <Link2
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <input
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder="https://instagram.com/… or @username"
                    required
                    className="min-w-0 w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
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
                  label="Quality"
                  value={selected?.quality || quality || "—"}
                />
                <SummaryRow
                  label="Package"
                  value={selected?.name ?? "—"}
                />
                <SummaryRow
                  label="Quantity"
                  value={
                    selected && quantityValid && quantity != null
                      ? `${quantity.toLocaleString()} ${selected.metric}`
                      : isCustomComments
                        ? "Add comments"
                        : "Enter quantity"
                  }
                />
                <SummaryRow label="Target" value={profileUrl || "—"} />
                <SummaryRow
                  label="Amount"
                  value={
                    selected && quantityValid && quantity != null
                      ? money(amount)
                      : "—"
                  }
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

            {/* Desktop: clear gap between instructions and submit */}
            <div className="hidden pt-4 sm:block">
              <MotionSection delay={0.14}>
                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  whileHover={canSubmit ? { y: -2 } : undefined}
                  whileTap={canSubmit ? { scale: 0.985 } : undefined}
                  className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
                >
                  {submitLabel}
                </motion.button>
              </MotionSection>
            </div>

            {/* Mobile: space = visual gap + sticky CTA height */}
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
                {submitLabel}
              </button>
            </div>
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

function BoostField({
  label,
  isMobile,
  value,
  placeholder,
  options,
  disabled,
  sheetTitle,
  sheetDescription,
  onChange,
  required,
}: {
  label: string;
  isMobile: boolean;
  value: string;
  placeholder: string;
  options: BoostOption[];
  disabled?: boolean;
  sheetTitle: string;
  sheetDescription: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  if (isMobile) {
    return (
      <div className="flex w-full flex-col gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            selectClassName,
            "relative flex items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              selected ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          {selected?.trailing ? (
            <span className="shrink-0 text-sm font-semibold text-muted-foreground">
              {selected.trailing}
            </span>
          ) : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>

        <Drawer
          open={open}
          onOpenChange={setOpen}
          shouldScaleBackground={false}
          repositionInputs={false}
          handleOnly
        >
          <DrawerContent className="h-[min(78dvh,640px)] max-h-[78dvh] w-full max-w-full rounded-t-[28px] border-border sm:mx-auto sm:max-w-lg">
            <DrawerHeader className="shrink-0 gap-1 border-b border-border px-4 pb-3 pt-1 text-left sm:px-5">
              <DrawerTitle className="text-base sm:text-lg">
                {sheetTitle}
              </DrawerTitle>
              <DrawerDescription className="text-xs sm:text-sm">
                {sheetDescription}
              </DrawerDescription>
            </DrawerHeader>
            <div
              className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]"
              data-vaul-no-drag=""
            >
              <div className="pb-4">
                {options.length ? (
                  options.map((option) => {
                    const active = option.value === value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex min-h-[56px] w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-muted/70 hover:bg-muted/50",
                          active && "bg-oryno-orange-muted",
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {option.label}
                          </p>
                          {option.description ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {option.description}
                            </p>
                          ) : null}
                        </div>
                        {option.trailing ? (
                          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                            {option.trailing}
                          </span>
                        ) : null}
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
                  })
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {placeholder}
                  </p>
                )}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <AuthField label={label}>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={selectClassName}
          required={required}
        >
          {required || !value ? (
            <option value="">{placeholder}</option>
          ) : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {option.trailing ? ` · ${option.trailing}` : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </AuthField>
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
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[68%] break-words text-right font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
