"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
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
            className="inline-flex h-10 items-center gap-1.5 rounded-[14px] bg-oryno-orange-muted px-3.5 text-sm font-bold text-primary disabled:opacity-60"
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
          <MotionSection className="flex flex-wrap gap-2">
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
          </MotionSection>

          <MotionSection
            delay={0.04}
            className="mt-3 flex items-center justify-between gap-3"
          >
            <button
              type="button"
              onClick={() => setSheet("month")}
              className="inline-flex items-center gap-1.5 rounded-[14px] bg-muted px-3 py-2 text-sm font-bold text-foreground"
            >
              {activeMonth?.label ?? "—"}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            <Link
              href={`/history/analytics?month=${encodeURIComponent(activeMonth?.key ?? "")}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-white"
            >
              <PieChart className="h-3.5 w-3.5" />
              Analysis
            </Link>
          </MotionSection>

          <MotionSection
            delay={0.06}
            className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold text-muted-foreground"
          >
            <p>
              In{" "}
              <span className="font-bold text-oryno-success">
                {formatMoneyAmount(totals.inflow, currency)}
              </span>
            </p>
            <p>
              Out{" "}
              <span className="font-bold text-foreground">
                {formatMoneyAmount(totals.outflow, currency)}
              </span>
            </p>
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
                    className="overflow-hidden rounded-[28px] bg-background shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between px-4 py-3 sm:px-5">
                      <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {group.date}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {group.items.length}{" "}
                        {group.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="px-1.5 pb-1 sm:px-2">
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-w-0 flex-1 items-center justify-between gap-2 rounded-[14px] px-3.5 py-2.5 text-sm font-bold transition sm:flex-none sm:min-w-[160px]",
        active
          ? "bg-oryno-orange-muted text-primary"
          : "bg-muted text-foreground",
      )}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0",
          active ? "text-primary" : "text-muted-foreground",
        )}
      />
    </button>
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
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="relative z-10 max-h-[78vh] w-full overflow-hidden rounded-t-[28px] bg-background shadow-[var(--shadow-soft)] sm:max-w-md sm:rounded-[28px]"
          >
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
  options: Array<{ id: string; title: string; subtitle?: string; trailing?: string }>;
}) {
  return (
    <div className="space-y-1 p-2">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
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
            {option.trailing ? (
              <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                {option.trailing}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
