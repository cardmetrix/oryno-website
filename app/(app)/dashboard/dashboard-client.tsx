"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MoreHorizontal,
  Phone,
  Smartphone,
  TrendingUp,
  Wifi,
} from "lucide-react";
import { AdCarousel } from "@/components/app/ad-carousel";
import { AppShell } from "@/components/app/app-shell";
import { DashboardHeader } from "@/components/app/dashboard-header";
import { DashboardWalletCarousel } from "@/components/app/dashboard-wallet-carousel";
import { HistoryEmpty } from "@/components/app/history-states";
import { MotionSection } from "@/components/app/motion-section";
import { TransactionRow } from "@/components/app/transaction-row";
import { ServiceActionCard } from "@/components/app/service-action-card";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/use-wallet";
import { fetchTransactions } from "@/hooks/use-transactions";
import { TRANSACTIONS_QUERY_KEY } from "@/lib/query-keys";
import { useProcessingTransactionRefresh } from "@/hooks/use-processing-transaction-refresh";
import { useSettlePendingTransactions } from "@/hooks/use-settle-pending-transactions";
import type { AppTransaction } from "@/lib/transactions";

const quickActions = [
  { href: "/services/gift-cards", label: "Buy Gift Cards", icon: GiftCardIcon },
  { href: "/services/social", label: "Boosting", icon: TrendingUp },
  { href: "/services/virtual-numbers", label: "Numbers", icon: Phone },
  { href: "/services/airtime", label: "Airtime", icon: Smartphone },
  { href: "/services/data", label: "Data", icon: Wifi },
  { href: "/services", label: "More", icon: MoreHorizontal },
];

export function DashboardClient() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useWallet();
  useSettlePendingTransactions(true);
  useProcessingTransactionRefresh(true);
  const recent = (data?.recent.slice(0, 4) ?? []) as AppTransaction[];
  const loadingTx = isLoading && !data;

  useEffect(() => {
    if (!data) return;
    void queryClient.prefetchQuery({
      queryKey: TRANSACTIONS_QUERY_KEY,
      queryFn: fetchTransactions,
      staleTime: 60_000,
    });
  }, [data, queryClient]);

  return (
    <AppShell>
      <DashboardHeader />

      <div className="space-y-1">
        <MotionSection className="min-w-0">
          <DashboardWalletCarousel />
        </MotionSection>
      </div>

      <MotionSection className="mt-2 mb-2">
        <div className="space-y-4 sm:space-y-5">
          <MotionSection className="rounded-[20px] border border-border/80 bg-background/90 p-3.5 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:rounded-[22px] sm:p-4">
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground sm:text-[15px]">
                Quick Actions
              </h2>
              <Link
                href="/services"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary sm:text-xs"
              >
                View all
                <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-2">
              {quickActions.map((action, index) => (
                <ServiceActionCard
                  key={action.label}
                  href={action.href}
                  label={action.label}
                  icon={action.icon}
                  index={index}
                  size="sm"
                />
              ))}
            </div>
          </MotionSection>
        </div>
      </MotionSection>
      <AdCarousel />
      <MotionSection className="mt-2 rounded-[28px] border border-border/80 bg-background/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Recent Transactions
          </h2>
          <motion.div whileHover={{ x: 2 }}>
            <Link
              href="/history"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary"
            >
              See All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>

        {loadingTx ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`items-center gap-3 py-2 ${i >= 2 ? "hidden md:flex" : "flex"}`}
              >
                <Skeleton className="h-11 w-11 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3 rounded-full" />
                  <Skeleton className="h-3 w-1/3 rounded-full" />
                </div>
                <Skeleton className="h-4 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : recent.length === 0 ? (
          <HistoryEmpty />
        ) : (
          <div className="divide-y divide-border">
            {recent.map((tx, i) => (
              <div key={tx.id} className={i >= 2 ? "hidden md:block" : ""}>
                <TransactionRow transaction={tx} index={i} />
              </div>
            ))}
          </div>
        )}
      </MotionSection>
    </AppShell>
  );
}
