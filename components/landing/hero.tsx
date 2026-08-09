"use client";

import { motion } from "framer-motion";
import { AuthButtons } from "./auth-buttons";
import { fadeUp, scaleIn, stagger } from "./motion";
import { PhoneFrame } from "./phone-frame";
import { StoreButtons } from "./store-buttons";

type HeroProps = {
  homeSrc?: string;
  walletSrc?: string;
};

export function Hero({ homeSrc, walletSrc }: HeroProps) {
  return (
    <section
      id="top"
      className="hero-atmosphere relative min-h-[100svh] overflow-hidden pt-16"
    >
      <div
        aria-hidden="true"
        className="dot-grid pointer-events-none absolute inset-0 opacity-[0.35]"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-10%] h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl"
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-[-8%] h-[320px] w-[320px] rounded-full bg-oryno-orange-soft/20 blur-3xl"
        animate={{ opacity: [0.25, 0.5, 0.25], scale: [1.05, 1, 1.05] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-12 px-5 pb-16 pt-10 sm:px-6 md:max-w-none lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-20 lg:pt-8">
        <motion.div
          className="max-w-xl"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.p variants={fadeUp} className="eyebrow mb-4 tracking-[0.18em]">
            ORYNO
          </motion.p>

          <motion.h1
            variants={fadeUp}
            className="text-[2.6rem] leading-[1.05] font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem]"
          >
            One App.
            <br />
            <span className="bg-gradient-to-r from-oryno-orange to-oryno-orange-soft bg-clip-text text-transparent">
              Endless Possibilities.
            </span>
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
         The smarter way to manage your digital life—buy and sell gift cards, purchase airtime and data, pay bills, get virtual numbers, and grow your social media, all in one secure app built for Africa.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-8 flex flex-col gap-4">
            <AuthButtons size="large" layout="responsive" />
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-5 text-sm text-muted-foreground"
          >
            Free to download · Secure wallet · Multi-country ready
          </motion.p>
        </motion.div>

        <motion.div
          variants={scaleIn}
          initial="hidden"
          animate="show"
          className="relative flex items-end justify-center lg:justify-end"
        >
          <div
            aria-hidden="true"
            className="absolute bottom-8 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl lg:left-auto lg:right-16 lg:translate-x-0"
          />

          <div className="relative flex items-end gap-4 sm:gap-6">
            <motion.div
              className="hidden translate-y-10 sm:block"
              animate={{ y: [40, 28, 40] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <PhoneFrame
                alt="ORYNO wallet screenshot"
                label="Wallet screen"
                src={walletSrc}
                fileName="wallet.png"
                className="scale-[0.88] opacity-90"
              />
            </motion.div>
            <motion.div
              className="relative z-10"
              animate={{ y: [0, -12, 0] }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.4,
              }}
            >
              <PhoneFrame
                alt="ORYNO home screenshot"
                label="Home screen"
                src={homeSrc}
                fileName="home.png"
                priority
              />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
