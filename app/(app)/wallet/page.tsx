"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Search, ShieldCheck, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { TransactionRow } from "@/components/app/transaction-row";
import { walletHistory } from "@/lib/demo-data";

export default function WalletPage() {
  return (
    <AppShell>
      <PageHeader
        title="My Wallets"
        subtitle="Manage balances across currencies"
        backHref="/dashboard"
        actions={
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)]"
            aria-label="Search wallets"
          >
            <Search className="h-5 w-5 text-foreground" strokeWidth={1.75} />
          </button>
        }
      />

      <MotionSection className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <motion.div
          whileHover={{ y: -4 }}
          className="min-w-[230px] flex-1 rounded-[22px] bg-gradient-to-br from-oryno-orange to-oryno-orange-soft p-5 text-white shadow-[var(--shadow-orange)] sm:min-w-0"
        >
          <p className="text-xs text-white/85">NGN · Total balance</p>
          <p className="mt-2 text-2xl font-bold">₦1,245,600.00</p>
          <p className="mt-3 text-[11px] text-white/80">1 wallet · Primary</p>
        </motion.div>
        <motion.div
          whileHover={{ y: -4 }}
          className="min-w-[230px] flex-1 rounded-[22px] bg-[#2563EB] p-5 text-white shadow-[var(--shadow-md)] sm:min-w-0"
        >
          <p className="text-xs text-white/85">USD · Total balance</p>
          <p className="mt-2 text-2xl font-bold">$2,450.00</p>
          <p className="mt-3 text-[11px] text-white/80">1 wallet</p>
        </motion.div>
      </MotionSection>

      <MotionSection
        delay={0.08}
        className="mt-6 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Total Balance (NGN Equivalent)
            </p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              ₦1,245,600.00
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all your currency wallets · Updated just now
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-oryno-orange-muted px-2.5 py-1 text-[11px] font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            Protected
          </span>
        </div>
      </MotionSection>

      <MotionSection delay={0.12} className="mt-5 grid grid-cols-2 gap-3">
        <Link
          href="/fund"
          className="btn-primary inline-flex h-12 items-center justify-center gap-2 text-sm"
        >
          <Plus className="h-4 w-4" />
          Fund
        </Link>
        <Link
          href="/withdraw"
          className="btn-secondary inline-flex h-12 items-center justify-center gap-2 text-sm"
        >
          <ArrowUpRight className="h-4 w-4" />
          Withdraw
        </Link>
      </MotionSection>

      <MotionSection
        delay={0.16}
        className="mt-8 rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            NGN Wallet History
          </h2>
          <Link href="/history" className="text-sm font-semibold text-primary">
            See all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {walletHistory.map((tx) => (
            <TransactionRow key={tx.id} transaction={tx} />
          ))}
        </div>
      </MotionSection>
    </AppShell>
  );
}
