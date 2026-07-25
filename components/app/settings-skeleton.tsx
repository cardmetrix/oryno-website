"use client";

import { MotionSection } from "@/components/app/motion-section";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 3 }).map((_, section) => (
        <MotionSection key={section} delay={section * 0.04}>
          <Skeleton className="mb-2 h-3 w-28 rounded-full" />
          <div className="overflow-hidden rounded-[22px] border border-border bg-background p-2 shadow-[var(--shadow-soft)]">
            {Array.from({ length: 3 }).map((_, row) => (
              <div
                key={row}
                className="flex items-center justify-between gap-3 px-3 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <Skeleton className="h-4 w-32 rounded-full" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </MotionSection>
      ))}
    </div>
  );
}
