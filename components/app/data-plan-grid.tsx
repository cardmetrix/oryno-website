"use client";

import { useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import {
  buildDataPlanFilters,
  parseDataPlanMeta,
  planMatchesFilter,
} from "@/lib/vtpass/catalog";
import { cn } from "@/lib/utils";

export type DataPlanOption = {
  id: string;
  name: string;
  amount: number;
};

type Props = {
  plans: DataPlanOption[];
  value: string;
  onChange: (id: string) => void;
  filter: string;
  onFilterChange: (filter: string) => void;
  formatMoney: (amount: number) => string;
  loading?: boolean;
  className?: string;
};

export function DataPlanGrid({
  plans,
  value,
  onChange,
  filter,
  onFilterChange,
  formatMoney,
  loading,
  className,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const filters = useMemo(
    () => buildDataPlanFilters(plans.map((p) => p.name)),
    [plans],
  );

  const activeFilter =
    filter && filters.includes(filter) ? filter : filters[0] || "Weekly";

  const filtered = useMemo(() => {
    if (!activeFilter) return plans;
    return plans.filter((p) => planMatchesFilter(p.name, activeFilter));
  }, [plans, activeFilter]);

  function scrollFilters() {
    scrollerRef.current?.scrollBy({ left: 120, behavior: "smooth" });
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-foreground">
          Select Plan Type
        </h2>
        {filters.length > 3 ? (
          <button
            type="button"
            onClick={scrollFilters}
            aria-label="More plan types"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div
        ref={scrollerRef}
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-9 w-20 shrink-0 animate-pulse rounded-full bg-muted"
              />
            ))
          : filters.map((f) => {
              const active = f === activeFilter;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => onFilterChange(f)}
                  className={cn(
                    "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
                    active
                      ? "bg-primary text-white shadow-[var(--shadow-soft)]"
                      : "bg-muted text-foreground hover:bg-muted/80",
                  )}
                >
                  {f}
                </button>
              );
            })}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[118px] animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl bg-muted px-4 py-10 text-center text-sm text-muted-foreground">
          No plans for this type
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((plan, index) => {
            const meta = parseDataPlanMeta(plan.name);
            const selected = value === plan.id;
            return (
              <motion.button
                key={plan.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.02, 0.18) }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange(plan.id)}
                className={cn(
                  "flex flex-col items-start rounded-2xl bg-muted px-3.5 py-3.5 text-left transition",
                  selected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:bg-muted/80",
                )}
              >
                <span className="rounded-full bg-oryno-orange-muted px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {meta.badge}
                </span>
                <p className="mt-2.5 text-lg font-extrabold tracking-tight text-foreground">
                  {meta.size}
                </p>
                <p className="mt-1 text-[15px] font-bold text-primary">
                  {formatMoney(plan.amount)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {meta.validity}
                </p>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
