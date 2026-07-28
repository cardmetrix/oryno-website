"use client";

import { MotionSection } from "@/components/app/motion-section";
import { Skeleton } from "@/components/ui/skeleton";

export function ServicesSkeleton() {
  return (
    <div className="space-y-5">
      <MotionSection className="rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <Skeleton className="h-12 w-full rounded-[16px]" />
        <div className="mt-4 flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 shrink-0 rounded-full" />
          ))}
        </div>
      </MotionSection>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <MotionSection
            key={i}
            delay={i * 0.03}
            className="flex flex-col items-center rounded-[22px] border border-border bg-background px-3 py-5 shadow-[var(--shadow-soft)] sm:rounded-[24px] sm:py-6"
          >
            <Skeleton className="h-14 w-14 rounded-2xl sm:h-16 sm:w-16" />
            <Skeleton className="mt-3 h-3 w-16 rounded-full" />
          </MotionSection>
        ))}
      </div>
    </div>
  );
}
