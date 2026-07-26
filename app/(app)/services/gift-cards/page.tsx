"use client";

import { motion } from "framer-motion";
import { ArrowRight, Bell, Gift, Sparkles } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { activeCountryConfig } from "@/lib/services-catalog";

export default function GiftCardsPage() {
  const { giftCardBrands, giftCardsEnabled } = activeCountryConfig;

  return (
    <AppShell hideNav>
      <PageHeader
        title="Gift Cards"
        subtitle="Buy & sell — coming soon to ORYNO"
        backHref="/services"
      />

      <MotionSection className="relative overflow-hidden rounded-[28px] border border-border bg-background p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-oryno-orange-soft/20 blur-3xl"
        />

        <div className="relative">
          <span className="badge-soon">Coming soon</span>
          <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-oryno-orange to-oryno-orange-soft text-white shadow-[var(--shadow-orange)]">
            <Gift className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Gift cards are almost here
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Buy and sell Amazon, Apple, Google Play, Steam, PlayStation, Xbox,
            Netflix, Spotify and more — with live rates and wallet credit.
            We&apos;re finishing the marketplace for a secure launch.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary inline-flex h-12 items-center gap-2 px-5"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              Notify me
            </motion.button>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/services"
                className="btn-secondary inline-flex h-12 items-center gap-2 px-5"
              >
                Browse other services
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
          </div>

          {!giftCardsEnabled ? (
            <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Disabled in your country until launch
            </p>
          ) : null}
        </div>
      </MotionSection>

      <MotionSection delay={0.08} className="mt-5">
        <h3 className="mb-3 px-1 text-sm font-semibold text-foreground">
          Brands launching with us
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {giftCardBrands.map((brand, index) => (
            <motion.div
              key={brand.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.04 }}
              whileHover={{ y: -3 }}
              className="relative overflow-hidden rounded-[20px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]"
            >
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white"
                style={{ background: brand.color }}
              >
                {brand.name.slice(0, 1)}
              </div>
              <p className="text-sm font-semibold text-foreground">
                {brand.name}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {brand.category}
              </p>
              <span className="absolute top-3 right-3 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                Soon
              </span>
            </motion.div>
          ))}
        </div>
      </MotionSection>
    </AppShell>
  );
}
