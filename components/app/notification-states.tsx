"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bell, BellOff, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <Skeleton className="h-12 w-full rounded-[16px]" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-[20px] border border-border bg-background px-3.5 py-3.5 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-11 w-11 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3 rounded-full" />
              <Skeleton className="h-3 w-full rounded-full" />
              <Skeleton className="h-3 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsEmpty({
  filtered,
  onClear,
}: {
  filtered?: boolean;
  onClear?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-[28px] border border-border bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]"
    >
      <motion.span
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 18 }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-oryno-orange-muted text-primary shadow-[var(--shadow-soft)]"
      >
        {filtered ? (
          <SearchX className="h-7 w-7" strokeWidth={1.75} />
        ) : (
          <BellOff className="h-7 w-7" strokeWidth={1.75} />
        )}
      </motion.span>
      <h3 className="text-lg font-bold tracking-tight text-foreground">
        {filtered ? "No matches" : "You're all caught up"}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {filtered
          ? "Try another filter or search to find older alerts."
          : "When you fund, withdraw, or get promos, they’ll show up here instantly."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        {filtered && onClear ? (
          <button
            type="button"
            onClick={onClear}
            className="btn-secondary h-11 px-5 text-sm"
          >
            Clear filters
          </button>
        ) : (
          <Link
            href="/fund"
            className="btn-primary inline-flex h-11 items-center px-5 text-sm"
          >
            Fund wallet
          </Link>
        )}
        <Link
          href="/services"
          className="inline-flex h-11 items-center rounded-[14px] px-4 text-sm font-semibold text-primary"
        >
          Explore services
        </Link>
      </div>
    </motion.div>
  );
}

export function NotificationsError({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-[28px] border border-border bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]"
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <WifiOff className="h-6 w-6" />
      </span>
      <p className="text-lg font-bold text-foreground">
        Couldn’t load notifications
      </p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="btn-primary mt-5 inline-flex h-11 items-center gap-2 px-5 text-sm"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </motion.div>
  );
}

export function NotificationsDropdownSkeleton() {
  return (
    <div className="space-y-1 px-2 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-[18px] px-3 py-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-3/4 rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NotificationsDropdownEmpty({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bell className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-semibold text-foreground">All caught up</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {filter === "unread"
          ? "No unread notifications right now."
          : "You don’t have any notifications yet."}
      </p>
    </div>
  );
}
