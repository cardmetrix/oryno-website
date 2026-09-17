"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buildHistoryMonths,
  collectCategories,
  filterHistoryItems,
  formatMoneyAmount,
  summarizeCashflow,
} from "@/lib/history";
import { type AppTransaction } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import { useCountry } from "@/components/providers/country-provider";
import { useSettlePendingTransactions } from "@/hooks/use-settle-pending-transactions";

type StatementFormat = "pdf" | "xlsx";
type SheetKind = "month" | "statement" | null;

export default function HistoryPage() {
  const [items, setItems] = useState<AppTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [monthKey, setMonthKey] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [downloading, setDownloading] = useState(false);
  const { country } = useCountry();
  const { settle: settlePending } = useSettlePendingTransactions(true);

  const currency = useMemo(() => {
    const fromItems = items.find((item) => item.currency)?.currency;
    return (fromItems || country.currency || "NGN").toUpperCase();
  }, [items, country.currency]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const settled = await settlePending();
      if (
        settled &&
        (settled.completed ?? 0) + (settled.reversed ?? 0) + (settled.failed ?? 0) > 0
      ) {
        toast.message("Pending transactions updated", {
          description:
            "Older pending withdrawals were completed or returned to your wallet.",
        });
      }
      const txRes = await fetch("/api/transactions", { cache: "no-store" });
      if (!txRes.ok) throw new Error("Failed");
      const json = (await txRes.json()) as { items: AppTransaction[] };
      setItems(json.items ?? []);
    } catch {
      setError(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [settlePending]);

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
    <AppShell onRefresh={() => load()}>
      <PageHeader
        title="Transactions"
        backHref="/dashboard"
        actions={
          <button
            type="button"
            onClick={() => setSheet("statement")}
            disabled={downloading || loading}
            className="inline-flex h-10 items-center justify-center px-2 text-sm font-bold text-primary transition hover:opacity-80 disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Download"
            )}
          </button>
        }
      />

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <HistoryError onRetry={() => void load()} />
      ) : (
        <>
          <MotionSection className="grid grid-cols-2 gap-2.5">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger
                aria-label="Filter by category"
                className={cn(
                  "h-auto w-full rounded-2xl border-0 bg-muted px-3.5 py-3 text-sm font-semibold shadow-none focus:ring-1 focus:ring-primary/30 focus:ring-offset-0",
                  category !== "all" ? "text-primary" : "text-foreground",
                )}
              >
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-2xl">
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger
                aria-label="Filter by status"
                className={cn(
                  "h-auto w-full rounded-2xl border-0 bg-muted px-3.5 py-3 text-sm font-semibold shadow-none focus:ring-1 focus:ring-primary/30 focus:ring-offset-0",
                  status !== "all" ? "text-primary" : "text-foreground",
                )}
              >
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-2xl">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </MotionSection>

          <MotionSection
            delay={0.04}
            className="mt-4 overflow-hidden rounded-[24px] bg-background shadow-[var(--shadow-soft)] sm:mt-5"
          >
            <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => setSheet("month")}
                  className="inline-flex items-center gap-1 text-base font-bold text-foreground"
                >
                  {activeMonth?.label ?? "—"}
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">In</span>{" "}
                  <span className="font-semibold text-[var(--oryno-success)]">
                    {formatMoneyAmount(totals.inflow, currency)}
                  </span>
                  <span className="mx-2 text-border">·</span>
                  <span className="font-medium text-foreground">Out</span>{" "}
                  <span className="font-semibold text-foreground">
                    {formatMoneyAmount(totals.outflow, currency)}
                  </span>
                </p>
              </div>
              <Link
                href={`/history/analytics?month=${encodeURIComponent(activeMonth?.key ?? "")}`}
                className="inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-sm font-bold text-white shadow-[var(--shadow-soft)] transition hover:opacity-90"
              >
                Analysis
              </Link>
            </div>

            <div className="mt-2 px-3 pb-2 sm:px-4 sm:pb-3">
              <AnimatePresence mode="wait">
                {monthItems.length === 0 ? (
                  <div className="px-1 py-2">
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
                  </div>
                ) : (
                  <motion.div
                    key={`${activeMonth?.key}-${category}-${status}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="divide-y divide-border/50"
                  >
                    {monthItems.map((tx, index) => (
                      <TransactionRow
                        key={tx.id}
                        transaction={tx}
                        index={index}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </MotionSection>
        </>
      )}

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
