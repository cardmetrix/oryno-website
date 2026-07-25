"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Gift,
  MoreHorizontal,
  Phone,
  Smartphone,
  TrendingUp,
  Wifi,
} from "lucide-react";
import { AdCarousel } from "@/components/app/ad-carousel";
import { AppShell } from "@/components/app/app-shell";
import { DashboardHeader } from "@/components/app/dashboard-header";
import { MotionSection } from "@/components/app/motion-section";
import { TransactionRow } from "@/components/app/transaction-row";
import { WalletCard } from "@/components/app/wallet-card";
import { recentTransactions } from "@/lib/demo-data";

const quickActions = [
  { href: "/services/gift-cards", label: "Gift Cards", icon: Gift },
  { href: "/services/social", label: "Boosting", icon: TrendingUp },
  { href: "/services/virtual-numbers", label: "Numbers", icon: Phone },
  { href: "/services/airtime", label: "Airtime", icon: Smartphone },
  { href: "/services/data", label: "Data", icon: Wifi },
  { href: "/services", label: "More", icon: MoreHorizontal },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <DashboardHeader />

      <div className="grid items-stretch gap-4 sm:gap-5 lg:grid-cols-[1.35fr_0.85fr] lg:gap-6">
        <MotionSection delay={0.04} className="min-w-0">
          <WalletCard />
        </MotionSection>

        <MotionSection delay={0.08} className="min-w-0 lg:h-full">
          <AdCarousel />
        </MotionSection>
      </div>
      <MotionSection delay={0.14} className="mt-6">
 
        <div className="space-y-4 sm:space-y-5">
          <MotionSection
            delay={0.1}
            className="rounded-[28px] border border-border/80 bg-background/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">
                Quick Actions
              </h2>
              <Link
                href="/services"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {quickActions.map((action, index) => {
                const Icon = action.icon;
                return (
                  <motion.div
                    key={action.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + index * 0.03 }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Link
                      href={action.href}
                      className="group flex flex-col items-center gap-2 rounded-[18px] border border-transparent bg-muted/60 px-1.5 py-3 transition-all hover:border-primary/20 hover:bg-oryno-orange-muted hover:shadow-[var(--shadow-soft)] sm:px-2 sm:py-3.5"
                    >
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background text-primary shadow-[var(--shadow-soft)] transition-transform group-hover:scale-110 group-hover:bg-primary group-hover:text-white sm:h-12 sm:w-12">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </span>
                      <span className="text-center text-[11px] font-semibold text-foreground sm:text-xs">
                        {action.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </MotionSection>
        </div>
      </MotionSection>

      <MotionSection
        delay={0.2}
        className="mt-6 rounded-[28px] border border-border/80 bg-background/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur-sm sm:p-6"
      >
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
        <div className="divide-y divide-border">
          {recentTransactions.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      </MotionSection>
    </AppShell>
  );
}
