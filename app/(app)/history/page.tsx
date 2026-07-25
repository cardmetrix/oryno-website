"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import {
  HistoryEmpty,
  HistoryError,
  HistorySkeleton,
} from "@/components/app/history-states";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionRow } from "@/components/app/transaction-row";
import type { AppTransaction, TransactionGroup } from "@/lib/transactions";
import { cn } from "@/lib/utils";

const typeFilters = ["All", "Credit", "Debit"] as const;
const statusFilters = ["Any", "Completed", "Pending", "Failed"] as const;

export default function HistoryPage() {
  const [groups, setGroups] = useState<TransactionGroup[]>([]);
  const [items, setItems] = useState<AppTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [typeFilter, setTypeFilter] =
    useState<(typeof typeFilters)[number]>("All");
  const [statusFilter, setStatusFilter] =
    useState<(typeof statusFilters)[number]>("Any");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/transactions", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as {
        items: AppTransaction[];
        groups: TransactionGroup[];
      };
      setItems(json.items);
      setGroups(json.groups);
    } catch {
      setError(true);
      setItems([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const matchesType =
            typeFilter === "All" ||
            (typeFilter === "Credit" && item.type === "credit") ||
            (typeFilter === "Debit" && item.type === "debit");
          const matchesStatus =
            statusFilter === "Any" || item.status === statusFilter;
          const matchesQuery =
            !q ||
            item.title.toLowerCase().includes(q) ||
            item.subtitle.toLowerCase().includes(q) ||
            (item.category ?? "").toLowerCase().includes(q);
          return matchesType && matchesStatus && matchesQuery;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, typeFilter, statusFilter, query]);

  const hasActiveFilters =
    typeFilter !== "All" || statusFilter !== "Any" || Boolean(query.trim());

  const totals = useMemo(() => {
    let inflows = 0;
    let outflows = 0;
    for (const item of items) {
      const raw = Number(item.amount.replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(raw)) continue;
      if (item.type === "credit") inflows += Math.abs(raw);
      else outflows += Math.abs(raw);
    }
    return { inflows, outflows, count: items.length };
  }, [items]);

  function clearFilters() {
    setTypeFilter("All");
    setStatusFilter("Any");
    setQuery("");
  }

  return (
    <AppShell>
      <PageHeader
        title="History"
        subtitle="Track credits, debits, and pending activity"
        backHref="/dashboard"
      />

      {loading ? (
        <HistorySkeleton />
      ) : error ? (
        <HistoryError onRetry={() => void load()} />
      ) : (
        <>
          <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
            <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
              <Stat
                label="In"
                value={`₦${totals.inflows.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`}
                tone="credit"
              />
              <Stat
                label="Out"
                value={`₦${totals.outflows.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`}
                tone="debit"
              />
              <Stat label="Txns" value={String(totals.count)} />
            </div>

            <div className="p-4 sm:p-5">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title, service, note…"
                  className="h-12 w-full rounded-[16px] border border-border bg-muted/40 pr-4 pl-10 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
                />
              </div>

              <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <span className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </span>
                {typeFilters.map((item) => (
                  <FilterChip
                    key={item}
                    active={typeFilter === item}
                    onClick={() => setTypeFilter(item)}
                    label={item}
                  />
                ))}
                <span className="mx-1 h-5 w-px shrink-0 bg-border" />
                {statusFilters.map((item) => (
                  <FilterChip
                    key={item}
                    active={statusFilter === item}
                    onClick={() => setStatusFilter(item)}
                    label={item}
                  />
                ))}
              </div>
            </div>
          </MotionSection>

          <div className="mt-5 space-y-4 sm:mt-6 sm:space-y-5">
            <AnimatePresence mode="wait">
              {filteredGroups.length === 0 ? (
                <HistoryEmpty
                  filtered={hasActiveFilters || items.length > 0}
                  onClear={hasActiveFilters ? clearFilters : undefined}
                />
              ) : (
                filteredGroups.map((group, groupIndex) => (
                  <MotionSection
                    key={group.date}
                    delay={0.04 + groupIndex * 0.04}
                    className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center justify-between border-b border-border/80 px-4 py-3 sm:px-5">
                      <p className="text-[11px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {group.date}
                      </p>
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {group.items.length}{" "}
                        {group.items.length === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="divide-y divide-border/70 px-1.5 py-1 sm:px-2">
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
    </AppShell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "credit" | "debit";
}) {
  return (
    <div className="px-3 py-3.5 text-center sm:px-4 sm:py-4">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-sm font-bold tabular-nums sm:text-base",
          tone === "credit" && "text-oryno-success",
          tone === "debit" && "text-foreground",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-xs font-semibold transition sm:text-sm",
        active
          ? "bg-oryno-charcoal text-white shadow-[var(--shadow-soft)]"
          : "bg-muted text-muted-foreground hover:bg-oryno-orange-muted hover:text-primary",
      )}
    >
      {label}
    </button>
  );
}
