"use client";

import { motion } from "framer-motion";
import { fadeUp, stagger } from "./motion";
import { StoreButtons } from "./store-buttons";

export function Download() {
  return (
    <section id="download" className="relative overflow-hidden py-24 sm:py-28">
      <div aria-hidden="true" className="cta-gradient absolute inset-0" />
      <div
        aria-hidden="true"
        className="dot-grid-light absolute inset-0 opacity-30"
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-white/20 blur-3xl"
        animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.15, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-white/15 blur-3xl"
        animate={{ opacity: [0.15, 0.4, 0.15], y: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-6 md:max-w-none md:px-0">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.p
            variants={fadeUp}
            className="text-sm font-semibold tracking-[0.18em] text-white/80 uppercase"
          >
            Get ORYNO
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Available on iOS and Android.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mt-4 text-base leading-relaxed text-white/85 sm:text-lg"
          >
            Download ORYNO and manage airtime, data, bills, virtual numbers, and
            more — all from one premium app.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-8 flex w-full justify-center"
          >
            <StoreButtons
              size="large"
              variant="onBrand"
              className="w-full max-w-md sm:max-w-none sm:w-auto"
            />
          </motion.div>

        </motion.div>
      </div>
    </section>
  );
}
