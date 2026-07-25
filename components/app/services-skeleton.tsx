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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <MotionSection
            key={i}
            delay={i * 0.03}
            className="rounded-[28px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
          >
            <Skeleton className="h-14 w-14 rounded-2xl" />
            <Skeleton className="mt-4 h-4 w-2/3 rounded-full" />
            <Skeleton className="mt-2 h-3 w-full rounded-full" />
            <Skeleton className="mt-1.5 h-3 w-4/5 rounded-full" />
            <div className="mt-4 flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-14 rounded-full" />
            </div>
          </MotionSection>
        ))}
      </div>
    </div>
  );
}
