"use client";

import { MotionSection } from "@/components/app/motion-section";
import { Skeleton } from "@/components/ui/skeleton";

export function WalletSkeleton() {
  return (
    <div className="space-y-5">
      <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
        <div className="bg-gradient-to-br from-[#ff8124]/40 via-oryno-orange/30 to-[#e85d00]/40 p-5 sm:p-6">
          <Skeleton className="h-3 w-24 rounded-full bg-white/30" />
          <Skeleton className="mt-3 h-9 w-48 rounded-full bg-white/35" />
          <Skeleton className="mt-4 h-4 w-36 rounded-full bg-white/25" />
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <Skeleton className="h-[52px] rounded-[18px] bg-white/30" />
            <Skeleton className="h-[52px] rounded-[18px] bg-white/20" />
          </div>
        </div>
      </MotionSection>

      <MotionSection delay={0.04} className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-3 w-12 rounded-full" />
            <Skeleton className="mt-2 h-5 w-16 rounded-full" />
          </div>
        ))}
      </MotionSection>

      <MotionSection
        delay={0.08}
        className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div>
              <Skeleton className="h-4 w-28 rounded-full" />
              <Skeleton className="mt-2 h-3 w-40 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-10 w-24 rounded-[14px]" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-[18px]" />
          ))}
        </div>
      </MotionSection>

      <MotionSection
        delay={0.12}
        className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <Skeleton className="h-4 w-36 rounded-full" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-2xl" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-2/3 rounded-full" />
                <Skeleton className="mt-2 h-3 w-1/3 rounded-full" />
              </div>
              <Skeleton className="h-4 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </MotionSection>
    </div>
  );
}

export function WalletCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#ff8124]/50 via-oryno-orange/40 to-[#e85d00]/50 p-5 shadow-[var(--shadow-orange)] sm:rounded-[28px]">
        <Skeleton className="h-10 w-10 rounded-2xl bg-white/25" />
        <Skeleton className="mt-6 h-3 w-28 rounded-full bg-white/25" />
        <Skeleton className="mt-2 h-8 w-44 rounded-full bg-white/35" />
        <Skeleton className="mt-6 h-4 w-52 rounded-full bg-white/20" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <Skeleton className="h-[52px] rounded-[18px]" />
        <Skeleton className="h-[52px] rounded-[18px]" />
      </div>
    </div>
  );
}
