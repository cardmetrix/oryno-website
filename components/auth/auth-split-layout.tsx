"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";
import { fadeUp, stagger } from "@/components/landing/motion";
import { cn } from "@/lib/utils";

type AuthSplitLayoutProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  panelTitle?: string;
  panelSubtitle?: string;
  /** Optional content above the title (e.g. back link) */
  top?: React.ReactNode;
  className?: string;
};

export function AuthSplitLayout({
  children,
  title,
  subtitle,
  panelTitle = "One App. Endless Possibilities.",
  panelSubtitle = "Airtime, data, bills, wallet payouts — all in one premium experience.",
  top,
  className,
}: AuthSplitLayoutProps) {
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <div className="mx-auto grid min-h-[100svh] w-full md:grid-cols-2">
        {/* Left visual panel — md+ */}
        <motion.aside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden min-h-[100svh] overflow-hidden md:flex"
        >
          <Image
            src="/brand/auth-panel.jpg"
            alt="African woman celebrating with ORYNO digital services"
            fill
            priority
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-oryno-charcoal/90 via-oryno-charcoal/35 to-transparent" />
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.28) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />

          <div className="relative z-10 flex w-full flex-col justify-between p-8 lg:p-12">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <BrandLogo size={44} priority className="shadow-[var(--shadow-orange)]" />
              <span className="text-xl font-bold tracking-tight text-white">
                ORYNO
              </span>
            </motion.div>

            <div className="max-w-md">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.6 }}
              >
                <p className="text-sm font-semibold tracking-[0.18em] text-white/75 uppercase">
                  Premium digital services
                </p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white lg:text-4xl">
                  {panelTitle}
                </h2>
                <p className="mt-3 text-base leading-relaxed text-white/80">
                  {panelSubtitle}
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="mt-8 grid max-w-sm gap-3"
              >
                <FloatingStat
                  label="Wallet balance"
                  value="₦1,245,600.00"
                  delay={0}
                />
                <FloatingStat
                  label="Instant airtime"
                  value="Cashback on every top-up"
                  delay={0.15}
                />
              </motion.div>
            </div>
          </div>
        </motion.aside>

        {/* Right form panel */}
        <div className="relative flex min-h-[100svh] items-start justify-center overflow-y-auto px-5 py-8 sm:px-8 lg:items-center lg:px-12 lg:py-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(255,106,0,0.08),transparent_45%)]"
          />

          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className={cn(
              "relative z-10 w-full max-w-md",
              className,
            )}
          >
            <motion.div variants={fadeUp} className="mb-8 md:hidden">
              <BrandLogo
                size={44}
                priority
                className="shadow-[var(--shadow-orange)]"
              />
            </motion.div>

            {top ? (
              <motion.div variants={fadeUp} className="mb-5">
                {top}
              </motion.div>
            ) : null}

            <motion.div variants={fadeUp} className="mb-8">
              <h1 className="text-[2rem] font-bold tracking-tight text-foreground sm:text-[2.25rem]">
                {title}
              </h1>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                {subtitle}
              </p>
            </motion.div>

            <motion.div variants={fadeUp}>{children}</motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function FloatingStat({
  label,
  value,
  delay,
}: {
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{
        duration: 4.5,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className="rounded-[16px] border border-white/15 bg-white/10 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.18)] backdrop-blur-md"
    >
      <p className="text-xs font-medium text-white/70">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
    </motion.div>
  );
}
