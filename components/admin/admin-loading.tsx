"use client";

import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AdminSkeletonVariant =
  | "table"
  | "stats"
  | "cards"
  | "overview"
  | "reports"
  | "settings"
  | "split";

export function AdminLoadingBlock({
  variant = "table",
  className,
  rows = 6,
}: {
  variant?: AdminSkeletonVariant;
  className?: string;
  rows?: number;
}) {
  return (
    <motion.div
      role="status"
      aria-label="Loading"
      initial={{ opacity: 0.55 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className={cn("w-full", className)}
    >
      {variant === "overview" ? (
        <OverviewSkeleton />
      ) : variant === "stats" ? (
        <StatsSkeleton />
      ) : variant === "cards" ? (
        <CardsSkeleton />
      ) : variant === "reports" ? (
        <ReportsSkeleton />
      ) : variant === "settings" ? (
        <SettingsSkeleton />
      ) : variant === "split" ? (
        <SplitSkeleton />
      ) : (
        <TableSkeleton rows={rows} />
      )}
      <span className="sr-only">Loading…</span>
    </motion.div>
  );
}

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-36 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-[12px]" />
      </div>
      <div className="mb-3 hidden grid-cols-4 gap-3 border-b border-border pb-3 md:grid">
        <Skeleton className="h-3 w-16 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-full" />
        <Skeleton className="h-3 w-14 rounded-full" />
        <Skeleton className="h-3 w-16 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            className="rounded-[14px] border border-border/70 p-3 md:grid md:grid-cols-4 md:items-center md:gap-3 md:rounded-none md:border-0 md:p-0"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-28 rounded-full" />
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 md:mt-0 md:contents">
              <Skeleton className="h-3.5 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="col-span-2 h-3.5 w-24 rounded-full md:col-span-1 md:ml-auto" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-[18px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
        >
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="mt-3 h-8 w-32 rounded-full" />
          <Skeleton className="mt-3 h-3 w-20 rounded-full" />
        </motion.div>
      ))}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="rounded-[18px] border border-border bg-muted/40 p-4"
        >
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-28 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-36 rounded-full" />
          <Skeleton className="mt-2 h-3 w-full rounded-full" />
          <Skeleton className="mt-1.5 h-3 w-2/3 rounded-full" />
        </motion.div>
      ))}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5">
      <StatsSkeleton />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <TableSkeleton rows={5} />
        <div className="rounded-[18px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <Skeleton className="mb-4 h-4 w-24 rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="flex items-start gap-3 rounded-[16px] border border-border/80 px-3.5 py-3"
              >
                <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <CardsSkeleton />
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <div className="space-y-5">
      <StatsSkeleton />
      <div className="rounded-[18px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <Skeleton className="mb-5 h-4 w-48 rounded-full" />
        <div className="flex h-52 items-end gap-2 sm:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${30 + ((i * 17) % 60)}%` }}
              transition={{ delay: i * 0.04, duration: 0.45 }}
              className="w-full max-w-10 overflow-hidden rounded-t-[10px]"
            >
              <Skeleton className="h-full w-full rounded-t-[10px]" />
            </motion.div>
          ))}
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[18px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-3 w-28 rounded-full" />
            <Skeleton className="mt-3 h-9 w-36 rounded-full" />
            <Skeleton className="mt-2 h-3 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[18px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="mb-4 h-4 w-40 rounded-full" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="flex items-center justify-between gap-4 rounded-[16px] border border-border px-4 py-3.5"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-3.5 w-36 rounded-full" />
                    <Skeleton className="h-3 w-48 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-11 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-[18px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <Skeleton className="mb-4 h-4 w-44 rounded-full" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-[16px] border border-border px-4 py-3"
            >
              <Skeleton className="h-3 w-28 rounded-full" />
              <Skeleton className="mt-2 h-4 w-40 rounded-full" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-5 h-11 w-36 rounded-[14px]" />
      </div>
    </div>
  );
}

function SplitSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <TableSkeleton rows={5} />
      <TableSkeleton rows={5} />
    </div>
  );
}

export function AdminErrorBlock({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-muted/30 px-4 py-6 text-center">
      <p className="text-sm font-medium text-[var(--oryno-error)]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="btn-secondary mt-3 h-10 px-4 text-sm"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function AdminEmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-[18px] border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
