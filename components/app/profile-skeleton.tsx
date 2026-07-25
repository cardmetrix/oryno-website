"use client";

import { MotionSection } from "@/components/app/motion-section";
import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex flex-col items-center text-center">
          <Skeleton className="h-24 w-24 rounded-full sm:h-28 sm:w-28" />
          <Skeleton className="mt-4 h-6 w-40 rounded-full" />
          <Skeleton className="mt-2 h-4 w-28 rounded-full" />
          <Skeleton className="mt-3 h-7 w-32 rounded-full" />
        </div>
      </MotionSection>

      <MotionSection
        delay={0.05}
        className="overflow-hidden rounded-[28px] border border-border bg-background p-2 shadow-[var(--shadow-soft)]"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-3.5 sm:px-4"
          >
            <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-20 rounded-full" />
              <Skeleton className="h-4 w-3/4 max-w-[220px] rounded-full" />
            </div>
          </div>
        ))}
      </MotionSection>

      <MotionSection delay={0.08} className="space-y-3">
        <Skeleton className="h-12 w-full rounded-[16px]" />
        <Skeleton className="h-12 w-full rounded-[16px]" />
      </MotionSection>
    </div>
  );
}
