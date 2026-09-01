"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  Loader2,
  PieChart,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import {
  HistoryEmpty,
  HistoryError,
  HistorySkeleton,
} from "@/components/app/history-states";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionRow } from "@/components/app/transaction-row";
import {
  buildHistoryMonths,
  collectCategories,
  filterHistoryItems,
  formatMoneyAmount,
  summarizeCashflow,
} from "@/lib/history";
import {
  groupTransactionsByDate,
  type AppTransaction,
} from "@/lib/transactions";
import { cn } from "@/lib/utils";

type StatementFormat = "pdf" | "xlsx";
type SheetKind = "category" | "status" | "month" | "statement" | null;

export default function HistoryPage() {
  const [items, setItems] = useState<AppTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [monthKey, setMonthKey] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [downloading, setDownloading] = useState(false);
  const [currency, setCurrency] = useState("NGN");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
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
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const months = useMemo(() => buildHistoryMonths(items), [items]);

  useEffect(() => {
    if (!months.length) return;
    if (!monthKey || !months.some((m) => m.key === monthKey)) {
      setMonthKey(months[0].key);
    }
  }, [months, monthKey]);

  const activeMonth = months.find((m) => m.key === monthKey) ?? months[0];
  const categories = useMemo(() => collectCategories(items), [items]);

  const monthItems = useMemo(
    () =>
      filterHistoryItems(items, {
        monthKey: activeMonth?.key,
        category,
        status,
      }),
    [items, activeMonth?.key, category, status],
  );

  const totals = useMemo(() => summarizeCashflow(monthItems), [monthItems]);
  const groups = useMemo(
    () => groupTransactionsByDate(monthItems),
    [monthItems],
  );

  const categoryLabel =
    category === "all"
      ? "All Categories"
      : (categories.find((c) => c.id === category)?.label ?? "Category");
  const statusLabel =
    status === "all"
      ? "All Status"
      : status === "successful"
        ? "Successful"
        : status === "pending"
          ? "Pending"
          : "Failed";

  const hasActiveFilters = category !== "all" || status !== "all";

  async function onEmailStatement(format: StatementFormat) {
    setSheet(null);
    setDownloading(true);
    try {
      const res = await fetch("/api/transactions/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          month: activeMonth?.key ?? null,
        }),
      });
      const json = (await res.json()) as {
        error?: string;
        emailedTo?: string;
        format?: string;
      };
      if (!res.ok) throw new Error(json.error || "Could not email statement");
      toast.success("Statement sent", {
        description: json.emailedTo
          ? `${(json.format ?? format).toUpperCase()} emailed to ${json.emailedTo}`
          : `Your ${(json.format ?? format).toUpperCase()} statement is on the way.`,
      });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not email your statement. Please try again.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Transactions"
        subtitle="Wallet activity & statements"
        backHref="/dashboard"
        actions={
          <button
            type="button"
            onClick={() => setSheet("statement")}
            disabled={downloading || loading}
         className="inline-flex h-10 items-center justify-center gap-1.5 px-3.5 text-sm font-bold transition hover:opacity-80"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download
          </button>
        }
      />

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <HistoryError onRetry={() => void load()} />
      ) : (
        <>
          <MotionSection className="relative overflow-hidden rounded-[28px] border border-border/60 bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
            <div
              aria-hidden
              className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl"
            />
            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSheet("month")}
                className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-muted/50 px-3.5 py-2.5 text-sm font-bold text-foreground transition hover:border-primary/30 hover:bg-oryno-orange-muted/40"
              >
                {activeMonth?.label ?? "—"}
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              <Link
                href={`/history/analytics?month=${encodeURIComponent(activeMonth?.key ?? "")}`}
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-oryno-orange-muted px-3.5 text-sm font-bold text-primary transition hover:bg-primary hover:text-white"
              >
                <PieChart className="h-4 w-4" />
                Analysis
              </Link>
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="rounded-[20px] border border-[color-mix(in_srgb,var(--oryno-success)_25%,transparent)] bg-[color-mix(in_srgb,var(--oryno-success)_8%,transparent)] p-3.5"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-[var(--oryno-success)] uppercase">
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  In
                </div>
                <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-foreground">
                  {formatMoneyAmount(totals.inflow, currency)}
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-[20px] border border-border/70 bg-muted/40 p-3.5"
              >
                <div className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-muted-foreground uppercase">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Out
                </div>
                <p className="mt-1.5 truncate text-lg font-bold tabular-nums text-foreground">
                  {formatMoneyAmount(totals.outflow, currency)}
                </p>
              </motion.div>
            </div>
          </MotionSection>

          <MotionSection delay={0.05} className="mt-4 flex flex-wrap gap-2">
            <FilterPill
              label={categoryLabel}
              active={category !== "all"}
              onClick={() => setSheet("category")}
            />
            <FilterPill
              label={statusLabel}
              active={status !== "all"}
              onClick={() => setSheet("status")}
            />
            {hasActiveFilters ? (
              <motion.button
                type="button"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => {
                  setCategory("all");
                  setStatus("all");
                }}
                className="inline-flex h-[42px] items-center rounded-[14px] px-3 text-xs font-bold text-muted-foreground transition hover:text-foreground"
              >
                Clear filters
              </motion.button>
            ) : null}
          </MotionSection>

          <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
            <AnimatePresence mode="wait">
              {groups.length === 0 ? (
                <HistoryEmpty
                  filtered={hasActiveFilters || items.length > 0}
                  onClear={
                    hasActiveFilters
                      ? () => {
                          setCategory("all");
                          setStatus("all");
                        }
                      : undefined
                  }
                />
              ) : (
                groups.map((group, groupIndex) => (
                  <MotionSection
                    key={group.date}
                    delay={0.04 + groupIndex * 0.03}
                    className="overflow-hidden rounded-[28px] border border-border/50 bg-background shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3 sm:px-5">
                      <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {group.date}
                      </p>
                      <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-[var(--shadow-soft)]">
                        {group.items.length}{" "}
                        {group.items.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <div className="px-1.5 py-1 sm:px-2">
                      {group.items.map((tx, index) => (
                        <TransactionRow
                          key={tx.id}
                          transaction={tx}
                          index={index}
                        />
                      ))}
                    </div>
                  </MotionSection>
                ))
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      <PickerSheet
        open={sheet === "category"}
        title="Category"
        subtitle="Filter by service type"
        onClose={() => setSheet(null)}
      >
        <OptionList
          value={category}
          onChange={(id) => {
            setCategory(id);
            setSheet(null);
          }}
          options={[
            { id: "all", title: "All Categories" },
            ...categories.map((c) => ({ id: c.id, title: c.label })),
          ]}
        />
      </PickerSheet>

      <PickerSheet
        open={sheet === "status"}
        title="Status"
        subtitle="Filter by transaction result"
        onClose={() => setSheet(null)}
      >
        <OptionList
          value={status}
          onChange={(id) => {
            setStatus(id);
            setSheet(null);
          }}
          options={[
            { id: "all", title: "All Status" },
            { id: "successful", title: "Successful" },
            { id: "pending", title: "Pending" },
            { id: "failed", title: "Failed" },
          ]}
        />
      </PickerSheet>

      <PickerSheet
        open={sheet === "month"}
        title="Month"
        subtitle="Choose a statement period"
        onClose={() => setSheet(null)}
      >
        <OptionList
          value={activeMonth?.key ?? ""}
          onChange={(id) => {
            setMonthKey(id);
            setSheet(null);
          }}
          options={months.map((m) => ({
            id: m.key,
            title: m.longLabel,
            trailing: m.label,
          }))}
        />
      </PickerSheet>

      <PickerSheet
        open={sheet === "statement"}
        title="Email statement"
        subtitle={`We'll send ${activeMonth?.longLabel ?? "this month"} to your account email as PDF or Excel.`}
        onClose={() => setSheet(null)}
      >
        <OptionList
          value=""
          onChange={(id) => {
            if (id === "pdf" || id === "xlsx") void onEmailStatement(id);
          }}
          options={[
            {
              id: "pdf",
              title: "PDF document",
              subtitle: "Best for printing and records",
            },
            {
              id: "xlsx",
              title: "Excel spreadsheet",
              subtitle: "Best for accounting and filters",
            },
          ]}
        />
      </PickerSheet>
    </AppShell>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[16px] border px-3.5 py-2.5 text-sm font-bold transition sm:flex-none sm:min-w-[160px]",
        active
          ? "border-primary/30 bg-oryno-orange-muted text-primary"
          : "border-border/70 bg-background text-foreground shadow-[var(--shadow-soft)]",
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
    </motion.button>
  );
}

function PickerSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open ? (
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
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 48, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 28, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="relative z-10 max-h-[78vh] w-full overflow-hidden rounded-t-[28px] border border-border/60 bg-background shadow-[0_24px_80px_rgba(28,28,30,0.28)] sm:max-w-md sm:rounded-[28px]"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
            <div className="border-b border-border/70 px-5 py-4">
              <p className="text-base font-bold text-foreground">{title}</p>
              {subtitle ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-2 py-2">{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function OptionList({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: Array<{
    id: string;
    title: string;
    subtitle?: string;
    trailing?: string;
  }>;
}) {
  return (
    <div className="space-y-1 p-2">
      {options.map((option, index) => {
        const active = option.id === value;
        return (
          <motion.button
            key={option.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.2) }}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex w-full items-center justify-between gap-3 rounded-[16px] px-3.5 py-3 text-left transition",
              active
                ? "bg-oryno-orange-muted text-primary"
                : "hover:bg-muted/70",
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{option.title}</p>
              {option.subtitle ? (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {option.subtitle}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {option.trailing ? (
                <span className="text-xs font-semibold text-muted-foreground">
                  {option.trailing}
                </span>
              ) : null}
              {active ? <Check className="h-4 w-4 text-primary" /> : null}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
