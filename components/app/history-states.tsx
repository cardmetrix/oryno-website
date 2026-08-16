"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { History, Plus, RefreshCw, SearchX, WifiOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function HistorySkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-[28px] bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <Skeleton className="h-12 w-full rounded-[14px]" />
        <div className="mt-4 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, g) => (
        <div
          key={g}
          className="rounded-[28px] bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5"
        >
          <Skeleton className="mb-3 h-3 w-36 rounded-full" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-full" />
                  <Skeleton className="h-3 w-1/2 rounded-full" />
                </div>
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HistoryEmpty({
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
      className="flex flex-col items-center rounded-[28px] bg-background px-6 py-14 text-center shadow-[var(--shadow-soft)]"
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
          <History className="h-7 w-7" strokeWidth={1.75} />
        )}
      </motion.span>
      <h3 className="text-lg font-bold tracking-tight text-foreground">
        {filtered ? "No matches found" : "No transactions yet"}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {filtered
          ? "Try another search or clear filters to see your full history."
          : "When you fund your wallet or pay for services, your activity will show up here."}
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
            className="btn-primary inline-flex h-11 items-center gap-2 px-5 text-sm"
          >
            <Plus className="h-4 w-4" />
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

export function HistoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center rounded-[28px] border border-destructive/20 bg-destructive/[0.04] px-6 py-14 text-center shadow-[var(--shadow-soft)]"
    >
      <motion.span
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-destructive/10 text-destructive"
      >
        <WifiOff className="h-7 w-7" strokeWidth={1.75} />
      </motion.span>
      <h3 className="text-lg font-bold tracking-tight text-foreground">
        Couldn’t load history
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Something went wrong while fetching your transactions. Check your
        connection and try again.
      </p>
      <motion.button
        type="button"
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRetry}
        className="btn-primary mt-6 inline-flex h-11 items-center gap-2 px-5 text-sm"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </motion.button>
    </motion.div>
  );
}
