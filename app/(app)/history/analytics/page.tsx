"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Scale,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { HistorySkeleton } from "@/components/app/history-states";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  buildCategoryBreakdown,
  buildDailySeries,
  buildHistoryMonths,
  filterHistoryItems,
  formatMoneyAmount,
  summarizeCashflow,
} from "@/lib/history";
import type { AppTransaction } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { useCountry } from "@/components/providers/country-provider";

export default function HistoryAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <PageHeader
            title="Analysis"
            subtitle="Spending insights"
            backHref="/history"
          />
          <HistorySkeleton />
        </AppShell>
      }
    >
      <HistoryAnalyticsContent />
    </Suspense>
  );
}

function HistoryAnalyticsContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<AppTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthKey, setMonthKey] = useState(searchParams.get("month") ?? "");
  const [monthOpen, setMonthOpen] = useState(false);
  const { country } = useCountry();

  const currency = useMemo(() => {
    const fromItems = items.find((item) => item.currency)?.currency;
    return (fromItems || country.currency || "NGN").toUpperCase();
  }, [items, country.currency]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const txRes = await fetch("/api/transactions", { cache: "no-store" });
      if (!txRes.ok) throw new Error("Failed");
      const json = (await txRes.json()) as { items: AppTransaction[] };
      setItems(json.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(() => buildHistoryMonths(items), [items]);
  const paramMonth = searchParams.get("month") ?? "";

  useEffect(() => {
    if (!months.length) return;
    if (!monthKey || !months.some((m) => m.key === monthKey)) {
      setMonthKey(
        paramMonth && months.some((m) => m.key === paramMonth)
          ? paramMonth
          : months[0].key,
      );
    }
  }, [months, monthKey, paramMonth]);

  const activeMonth = months.find((m) => m.key === monthKey) ?? months[0];
  const monthItems = useMemo(
    () => filterHistoryItems(items, { monthKey: activeMonth?.key }),
    [items, activeMonth?.key],
  );
  const totals = useMemo(() => summarizeCashflow(monthItems), [monthItems]);
  const categories = useMemo(
    () => buildCategoryBreakdown(monthItems),
    [monthItems],
  );
  const series = useMemo(
    () => (activeMonth ? buildDailySeries(monthItems, activeMonth.key) : []),
    [monthItems, activeMonth],
  );

  const maxBar = Math.max(1, ...series.map((p) => Math.max(p.inflow, p.outflow)));
  const maxCategory = Math.max(1, ...categories.map((c) => c.total));
  const spendShare =
    totals.inflow + totals.outflow > 0
      ? totals.outflow / (totals.inflow + totals.outflow)
      : 0;

  return (
    <AppShell>
      <PageHeader
        title="Analysis"
        subtitle={activeMonth?.longLabel ?? "Spending insights"}
        backHref="/history"
        actions={
          <button
            type="button"
            onClick={() => setMonthOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-[14px] border border-border bg-background px-3.5 text-sm font-bold text-foreground shadow-[var(--shadow-soft)] transition hover:border-primary/30"
          >
            {activeMonth?.label ?? "—"}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </button>
        }
      />

      {loading ? (
        <HistorySkeleton />
      ) : (
        <>
          <MotionSection className="grid grid-cols-3 gap-3">
            {[
              {
                label: "In",
                value: formatMoneyAmount(totals.inflow, currency),
                icon: ArrowDownLeft,
                tone: "credit" as const,
              },
              {
                label: "Out",
                value: formatMoneyAmount(totals.outflow, currency),
                icon: ArrowUpRight,
                tone: "debit" as const,
              },
              {
                label: "Net",
                value: formatMoneyAmount(totals.net, currency, {
                  signed: true,
                  type: totals.net >= 0 ? "credit" : "debit",
                }),
                icon: Scale,
                tone: totals.net >= 0 ? ("credit" as const) : ("debit" as const),
              },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 + i * 0.05, duration: 0.35 }}
                  className={cn(
                    "rounded-[22px] border p-3.5 shadow-[var(--shadow-soft)]",
                    stat.tone === "credit"
                      ? "border-[color-mix(in_srgb,var(--oryno-success)_22%,transparent)] bg-[color-mix(in_srgb,var(--oryno-success)_7%,var(--background))]"
                      : "border-border/70 bg-background",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        stat.tone === "credit" && "text-[var(--oryno-success)]",
                      )}
                    />
                    {stat.label}
                  </div>
                  <p
                    className={cn(
                      "mt-1.5 truncate text-sm font-bold tabular-nums sm:text-base",
                      stat.tone === "credit" && "text-[var(--oryno-success)]",
                      stat.tone === "debit" && "text-foreground",
                    )}
                  >
                    {stat.value}
                  </p>
                </motion.div>
              );
            })}
          </MotionSection>

          <MotionSection
            delay={0.06}
            className="mt-5 overflow-hidden rounded-[28px] border border-border/50 bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="mb-5 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Daily cashflow
                </h2>
                <p className="text-sm text-muted-foreground">
                  In vs out for {activeMonth?.label}
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-oryno-orange-muted px-3 py-1.5 text-xs font-bold text-primary">
                {Math.round(spendShare * 100)}% spent
              </div>
            </div>

            <div className="relative mb-3 flex items-center gap-4 text-[11px] font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--oryno-success)]" />
                In
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Out
              </span>
            </div>

            <div className="relative flex h-44 items-end gap-1 overflow-x-auto pb-1">
              {series.length === 0 ? (
                <p className="self-center text-sm text-muted-foreground">
                  No daily activity yet.
                </p>
              ) : (
                series.map((point, index) => (
                  <motion.div
                    key={point.key}
                    initial={{ opacity: 0, scaleY: 0.2 }}
                    animate={{ opacity: 1, scaleY: 1 }}
                    transition={{
                      delay: Math.min(index * 0.012, 0.35),
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex min-w-[10px] flex-1 origin-bottom flex-col items-center justify-end gap-1"
                    title={`${point.label}: in ${point.inflow}, out ${point.outflow}`}
                  >
                    <div className="flex w-full items-end justify-center gap-0.5">
                      <div
                        className="w-1.5 rounded-full bg-[var(--oryno-success)]/85"
                        style={{
                          height: `${Math.max(4, (point.inflow / maxBar) * 140)}px`,
                        }}
                      />
                      <div
                        className="w-1.5 rounded-full bg-primary/85"
                        style={{
                          height: `${Math.max(4, (point.outflow / maxBar) * 140)}px`,
                        }}
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </MotionSection>

          <MotionSection
            delay={0.1}
            className="mt-5 rounded-[28px] border border-border/50 bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 className="text-base font-bold text-foreground">By category</h2>
            <p className="text-sm text-muted-foreground">
              Where money moved this month
            </p>
            <div className="mt-4 space-y-4">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity in this period.
                </p>
              ) : (
                categories.map((cat, index) => (
                  <motion.div
                    key={cat.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + index * 0.04 }}
                  >
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {cat.label}
                      </p>
                      <p className="shrink-0 text-xs font-bold text-muted-foreground">
                        {formatMoneyAmount(cat.total, currency)} · {cat.count}
                      </p>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(6, (cat.total / maxCategory) * 100)}%`,
                        }}
                        transition={{
                          delay: 0.1 + index * 0.05,
                          duration: 0.55,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-[#ff8a33]"
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </MotionSection>
        </>
      )}

      <AnimatePresence>
        {monthOpen ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
              onClick={() => setMonthOpen(false)}
            />
            <motion.div
              initial={{ y: 48, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 30 }}
              className="relative z-10 max-h-[78vh] w-full overflow-hidden rounded-t-[28px] border border-border/60 bg-background shadow-[0_24px_80px_rgba(28,28,30,0.28)] sm:max-w-md sm:rounded-[28px]"
            >
              <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
              <div className="border-b border-border/70 px-5 py-4">
                <p className="text-base font-bold text-foreground">Month</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Choose a statement period
                </p>
              </div>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto p-3">
                {months.map((m, index) => (
                  <motion.button
                    key={m.key}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                    onClick={() => {
                      setMonthKey(m.key);
                      setMonthOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[16px] px-3.5 py-3 text-left transition",
                      m.key === activeMonth?.key
                        ? "bg-oryno-orange-muted text-primary"
                        : "hover:bg-muted/70",
                    )}
                  >
                    <span className="text-sm font-bold">{m.longLabel}</span>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      {m.label}
                      {m.key === activeMonth?.key ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : null}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AppShell>
  );
}
