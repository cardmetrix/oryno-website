"use client";

import { motion } from "framer-motion";
import { ArrowLeftRight, ArrowRight, Wallet, Zap } from "lucide-react";
import { fadeUp, stagger } from "./motion";
import { PhoneFrame } from "./phone-frame";

const steps = [
  {
    icon: Wallet,
    title: "Credit your wallet",
    description:
      "Funds from deposits and transactions land in your ORYNO Wallet instantly in local currency.",
  },
  {
    icon: ArrowLeftRight,
    title: "Convert to USD",
    description:
      "Swap seamlessly between your local currency and USD with live, transparent exchange rates.",
  },
  {
    icon: Zap,
    title: "Pay for digital services",
    description:
      "Use your balance to purchase gift cards, virtual numbers, pay utility bills, and fund services with zero friction.",
  },
];

type WalletSectionProps = {
  walletSrc?: string;
};

export function WalletSection({ walletSrc }: WalletSectionProps) {
  return (
    <section id="wallet" className="surface-muted relative overflow-hidden py-24 sm:py-28">
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute top-10 right-0 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        animate={{ x: [0, -20, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 px-5 sm:px-6 md:max-w-none lg:grid-cols-2 lg:gap-16">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.p variants={fadeUp} className="eyebrow">
            ORYNO Wallet
          </motion.p>
          <motion.h2 variants={fadeUp} className="section-title">
            A wallet built to move with you.
          </motion.h2>
          <motion.p variants={fadeUp} className="section-copy max-w-lg">
            Keep local and USD balances, convert with live rates, and pay for all
            your everyday digital services with complete confidence.
          </motion.p>

          <div className="mt-10 space-y-5">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.45, delay: index * 0.1 }}
                  whileHover={{ x: 4 }}
                  className="flex gap-4 rounded-[var(--radius-lg)] bg-background/70 p-4 shadow-[var(--shadow-soft)] backdrop-blur-sm"
                >
                  <div className="icon-tile icon-tile-on-muted shrink-0">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <motion.a
            href="#download"
            whileHover={{ x: 4 }}
            className="mt-10 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-foreground"
          >
            Get ORYNO
            <ArrowRight className="h-4 w-4" />
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex justify-center"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-1/2 h-56 -translate-y-1/2 rounded-full bg-gradient-to-r from-primary/20 to-oryno-orange-soft/20 blur-3xl"
          />
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10"
          >
            <PhoneFrame
              alt="ORYNO wallet balance screenshot"
              label="Wallet balance"
              src={walletSrc}
              fileName="wallet.png"
            />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
