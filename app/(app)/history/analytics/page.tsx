"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
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
  const [currency, setCurrency] = useState("NGN");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [txRes, walletRes] = await Promise.all([
        fetch("/api/transactions", { cache: "no-store" }),
        fetch("/api/wallet", { cache: "no-store" }),
      ]);
      if (!txRes.ok) throw new Error("Failed");
      const json = (await txRes.json()) as { items: AppTransaction[] };
      setItems(json.items ?? []);
      if (walletRes.ok) {
        const wallet = (await walletRes.json()) as {
          totals?: { currency?: string };
          primary?: { currency?: string };
        };
        setCurrency(
          wallet.totals?.currency ??
            wallet.primary?.currency ??
            json.items?.[0]?.currency ??
            "NGN",
        );
      }
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
            className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-muted px-3.5 text-sm font-bold text-foreground"
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
                tone: "credit" as const,
              },
              {
                label: "Out",
                value: formatMoneyAmount(totals.outflow, currency),
                tone: "debit" as const,
              },
              {
                label: "Net",
                value: formatMoneyAmount(totals.net, currency, {
                  signed: true,
                  type: totals.net >= 0 ? "credit" : "debit",
                }),
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-[22px] bg-background p-3.5 shadow-[var(--shadow-soft)]"
              >
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {stat.label}
                </p>
                <p
                  className={cn(
                    "mt-1 truncate text-sm font-bold tabular-nums",
                    stat.tone === "credit" && "text-oryno-success",
                    stat.tone === "debit" && "text-foreground",
                  )}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </MotionSection>

          <MotionSection
            delay={0.05}
            className="mt-5 rounded-[28px] bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Daily cashflow
                </h2>
                <p className="text-sm text-muted-foreground">
                  In vs out for {activeMonth?.label}
                </p>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">
                {Math.round(spendShare * 100)}% spent
              </p>
            </div>
            <div className="flex h-40 items-end gap-1 overflow-x-auto pb-1">
              {series.map((point) => (
                <div
                  key={point.key}
                  className="flex min-w-[10px] flex-1 flex-col items-center justify-end gap-1"
                  title={`${point.label}: in ${point.inflow}, out ${point.outflow}`}
                >
                  <div className="flex w-full items-end justify-center gap-0.5">
                    <div
                      className="w-1 rounded-full bg-oryno-success/80"
                      style={{
                        height: `${Math.max(4, (point.inflow / maxBar) * 120)}px`,
                      }}
                    />
                    <div
                      className="w-1 rounded-full bg-primary/80"
                      style={{
                        height: `${Math.max(4, (point.outflow / maxBar) * 120)}px`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </MotionSection>

          <MotionSection
            delay={0.08}
            className="mt-5 rounded-[28px] bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <h2 className="text-base font-bold text-foreground">
              By category
            </h2>
            <p className="text-sm text-muted-foreground">
              Where money moved this month
            </p>
            <div className="mt-4 space-y-3">
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activity in this period.
                </p>
              ) : (
                categories.map((cat) => (
                  <div key={cat.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {cat.label}
                      </p>
                      <p className="shrink-0 text-xs font-bold text-muted-foreground">
                        {formatMoneyAmount(cat.total, currency)} · {cat.count}
                      </p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.max(6, (cat.total / maxCategory) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
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
              className="absolute inset-0 bg-black/40"
              onClick={() => setMonthOpen(false)}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="relative z-10 max-h-[78vh] w-full overflow-hidden rounded-t-[28px] bg-background shadow-[var(--shadow-soft)] sm:max-w-md sm:rounded-[28px]"
            >
              <div className="border-b border-border/70 px-5 py-4">
                <p className="text-base font-bold text-foreground">Month</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Choose a statement period
                </p>
              </div>
              <div className="max-h-[60vh] space-y-1 overflow-y-auto p-3">
                {months.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setMonthKey(m.key);
                      setMonthOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[16px] px-3.5 py-3 text-left",
                      m.key === activeMonth?.key
                        ? "bg-oryno-orange-muted text-primary"
                        : "hover:bg-muted/70",
                    )}
                  >
                    <span className="text-sm font-bold">{m.longLabel}</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {m.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </AppShell>
  );
}
