"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  CreditCard,
  Globe2,
  Megaphone,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tv,
  Wallet,
  Wifi,
  Zap,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { APP_VERSION_LABEL } from "@/lib/app-version";

const pillars = [
  {
    title: "Premium fintech feel",
    description:
      "Clean layouts, soft shadows, rounded corners, and smooth motion — inspired by Apple Wallet, Revolut, Monzo, and Cash App, with ORYNO’s own identity.",
  },
  {
    title: "Built for Africa",
    description:
      "Multi-country architecture with configurable currency, networks, bills, gateways, and payouts — expand without rewriting the product.",
  },
  {
    title: "Secure by default",
    description:
      "OTP, 2FA-ready flows, device recognition, encrypted APIs, KYC where required, and clear transaction logs you can trust.",
  },
];

const services = [
  {
    icon: Wallet,
    title: "ORYNO Wallet",
    description: "Fund, hold, spend, and withdraw in your local currency.",
  },
  {
    icon: Smartphone,
    title: "Airtime",
    description: "Instant top-ups across local mobile networks.",
  },
  {
    icon: Wifi,
    title: "Data Bundles",
    description: "Daily, weekly, and monthly packs from trusted providers.",
  },
  {
    icon: Zap,
    title: "Bill Payments",
    description: "Electricity and essential utilities in a few taps.",
  },
  {
    icon: Tv,
    title: "TV Subscriptions",
    description: "Renew DStv, GOtv, Startimes, and more.",
  },
  {
    icon: Phone,
    title: "Virtual Numbers",
    description: "Buy permanently or rent numbers for SMS verification.",
  },
  {
    icon: Megaphone,
    title: "Social Boosting",
    description: "Grow followers, likes, views, and engagement.",
  },
  {
    icon: GiftCardIcon,
    title: "Gift Cards",
    description: "Buy and sell gift cards with live rates into your wallet.",
  },
  {
    icon: CreditCard,
    title: "USD Virtual Card",
    description: "Spend your USD wallet online worldwide — joining waitlist now.",
    soon: true,
  },
];

const countries = [
  { flag: "🇳🇬", name: "Nigeria", currency: "NGN" },
  { flag: "🇬🇭", name: "Ghana", currency: "GHS" },
  { flag: "🇿🇦", name: "South Africa", currency: "ZAR" },
  { flag: "🇰🇪", name: "Kenya", currency: "KES" },
];

const values = [
  {
    title: "Simple",
    text: "First-time users should feel confident in seconds.",
  },
  {
    title: "Fast",
    text: "Instant services, clear statuses, and quick payouts.",
  },
  {
    title: "Trustworthy",
    text: "Transparent fees, secure flows, and reliable support.",
  },
  {
    title: "Scalable",
    text: "New countries join through configuration — not rewrites.",
  },
];

export default function AboutPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="About ORYNO"
        subtitle="One App. Endless Possibilities."
        backHref="/settings"
      />

      <MotionSection className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-oryno-orange to-oryno-orange-soft p-6 text-white shadow-[var(--shadow-orange-lg)] sm:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 -right-12 h-56 w-56 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-black/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <BrandLogo size={48} className="shadow-[0_10px_30px_rgba(28,28,30,0.25)]" />
            <div>
              <p className="text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">
                Brand
              </p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                ORYNO
              </h2>
            </div>
          </div>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/90 sm:text-lg">
            ORYNO is a premium digital services super app for Africa — airtime,
            data, bill payments, gift cards, virtual numbers, social boosting,
            and wallet payouts — with USD virtual cards on the way.
          </p>

          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-sm">
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            Slogan: One App. Endless Possibilities.
          </p>
          <p className="mt-3 text-xs font-medium tracking-wide text-white/70">
            App {APP_VERSION_LABEL}
          </p>
        </div>
      </MotionSection>

      <MotionSection delay={0.06} className="mt-5 grid gap-3 sm:grid-cols-3">
        {pillars.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + index * 0.05 }}
            whileHover={{ y: -3 }}
            className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
          >
            <p className="text-sm font-bold text-primary">{item.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </motion.div>
        ))}
      </MotionSection>

      <MotionSection
        delay={0.1}
        className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
            <Globe2 className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              What you can do with ORYNO
            </h3>
            <p className="text-sm text-muted-foreground">
              Phase 1 services designed for everyday digital life
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={service.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.03 }}
                className="relative flex items-start gap-3 rounded-[18px] border border-border/80 bg-muted/30 px-4 py-3.5"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-background text-primary shadow-[var(--shadow-soft)]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 pr-10">
                  <p className="text-sm font-semibold text-foreground">
                    {service.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {service.description}
                  </p>
                </div>
                {"soon" in service && service.soon ? (
                  <span className="badge-soon absolute top-3 right-3">Soon</span>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </MotionSection>

      <MotionSection
        delay={0.14}
        className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <h3 className="text-base font-semibold text-foreground">
          Multi-country ready
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Initial target markets with local currency and payout routing. New
          countries are added through configuration — currency, networks,
          utilities, gateways, and banks — without hardcoded country logic.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {countries.map((country, index) => (
            <motion.div
              key={country.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 + index * 0.04 }}
              whileHover={{ y: -2 }}
              className="rounded-[18px] border border-border bg-muted/40 px-4 py-4 text-center"
            >
              <p className="text-2xl">{country.flag}</p>
              <p className="mt-2 text-sm font-semibold text-foreground">
                {country.name}
              </p>
              <p className="text-xs text-muted-foreground">{country.currency}</p>
            </motion.div>
          ))}
        </div>
      </MotionSection>

      <MotionSection
        delay={0.18}
        className="mt-5 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
            <ShieldCheck className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Our design & product principles
            </h3>
            <p className="text-sm text-muted-foreground">
              Minimal · Premium · Clean · Modern · Fast · Spacious
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.04 }}
              className="rounded-[16px] border border-border/80 px-4 py-3.5"
            >
              <p className="text-sm font-bold text-primary">{value.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{value.text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 grid gap-2 rounded-[18px] bg-muted/50 p-4 text-sm text-muted-foreground sm:grid-cols-3">
          <p>
            <span className="font-semibold text-foreground">Primary</span>{" "}
            #FF6A00
          </p>
          <p>
            <span className="font-semibold text-foreground">Charcoal</span>{" "}
            #1C1C1E
          </p>
          <p>
            <span className="font-semibold text-foreground">White</span> #FFFFFF
          </p>
        </div>
      </MotionSection>

      <MotionSection
        delay={0.22}
        className="mt-5 mb-2 rounded-[28px] border border-border bg-muted/40 p-5 sm:p-6"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">
              Need help or have feedback?
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Our support team is ready via chat, tickets, and email.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/support"
                className="btn-primary inline-flex h-11 items-center justify-center gap-2 px-5 text-sm"
              >
                Contact support
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/terms"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-border bg-background px-5 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)]"
              >
                Terms
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/privacy"
                className="inline-flex h-11 items-center justify-center rounded-[14px] border border-border bg-background px-5 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)]"
              >
                Privacy
              </Link>
            </motion.div>
            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
              <Link
                href="/dashboard"
                className="btn-secondary inline-flex h-11 items-center justify-center px-5 text-sm"
              >
                Back to Home
              </Link>
            </motion.div>
          </div>
        </div>
      </MotionSection>
    </AppShell>
  );
}
