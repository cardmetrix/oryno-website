import { AppShell } from "@/components/app/app-shell";
import { WalletCardSkeleton } from "@/components/app/wallet-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <AppShell>
      <div className="sticky top-0 z-30 -mx-4 mb-6 border-b border-border/70 px-4 py-3.5 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-full" />
            <Skeleton className="h-4 w-40 rounded-full" />
          </div>
          <Skeleton className="h-10 w-10 rounded-[14px]" />
        </div>
      </div>

      <WalletCardSkeleton />

      <div className="mt-6 rounded-[28px] border border-border/80 p-5 sm:p-6">
        <Skeleton className="mb-4 h-4 w-28 rounded-full" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-[20px]" />
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3 rounded-[28px] border border-border/80 p-5 sm:p-6">
        <Skeleton className="mb-2 h-4 w-40 rounded-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="h-11 w-11 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 rounded-full" />
              <Skeleton className="h-3 w-1/3 rounded-full" />
            </div>
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
