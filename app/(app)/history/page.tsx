"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionRow } from "@/components/app/transaction-row";
import { historyGroups } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

const filters = ["All", "Credit", "Debit"] as const;

export default function HistoryPage() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    return historyGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          const matchesFilter =
            filter === "All" ||
            (filter === "Credit" && item.type === "credit") ||
            (filter === "Debit" && item.type === "debit");
          const matchesQuery =
            !query ||
            item.title.toLowerCase().includes(query.toLowerCase()) ||
            item.subtitle.toLowerCase().includes(query.toLowerCase());
          return matchesFilter && matchesQuery;
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [filter, query]);

  return (
    <AppShell>
      <PageHeader
        title="Transactions"
        subtitle="Track credits, debits, and pending activity"
        backHref="/dashboard"
      />

      <MotionSection className="rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions..."
            className="h-12 w-full rounded-[14px] border border-border bg-muted/50 pr-4 pl-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                filter === item
                  ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                  : "bg-muted text-foreground hover:bg-muted/80",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </MotionSection>

      <div className="mt-6 space-y-6">
        {groups.map((group, index) => (
          <MotionSection
            key={group.date}
            delay={0.06 + index * 0.05}
            className="rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5"
          >
            <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {group.date}
            </p>
            <div className="divide-y divide-border">
              {group.items.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </div>
          </MotionSection>
        ))}
      </div>
    </AppShell>
  );
}
