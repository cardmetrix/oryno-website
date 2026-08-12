"use client";

import { motion } from "framer-motion";
import { fadeUp, stagger } from "./motion";
import { StoreButtons } from "./store-buttons";

export function Download() {
  return (
    <section id="download" className="relative overflow-hidden py-24 sm:py-28">
      {/* Light: peach wash · Dark: deep charcoal with soft orange glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(145deg,#fff4eb_0%,#ffe0c8_28%,#ffb478_62%,#ff8f3d_100%)] dark:bg-[linear-gradient(145deg,#1a1210_0%,#241812_32%,#3a2214_68%,#4a2818_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.55),transparent_48%),radial-gradient(ellipse_at_bottom_right,rgba(255,106,0,0.22),transparent_52%)] dark:bg-[radial-gradient(ellipse_at_top_left,rgba(255,140,66,0.18),transparent_48%),radial-gradient(ellipse_at_bottom_right,rgba(255,106,0,0.28),transparent_55%)]"
      />

      {/* Soft diagonal line pattern */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.28] dark:opacity-[0.14]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-28deg, transparent 0 18px, rgba(255,255,255,0.45) 18px 19px)",
        }}
      />

      {/* Dot grid overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-40 dark:opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.55) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Geometric line accents */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40 dark:opacity-30"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="download-line" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.15)" />
          </linearGradient>
        </defs>
        <motion.path
          d="M-40 120 C 180 40, 320 220, 640 90 S 980 40, 1280 160"
          fill="none"
          stroke="url(#download-line)"
          strokeWidth="1.25"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
        <motion.path
          d="M-20 280 C 220 360, 420 180, 720 300 S 1100 380, 1400 240"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
          initial={{ pathLength: 0, opacity: 0 }}
          whileInView={{ pathLength: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.8, delay: 0.15, ease: "easeOut" }}
        />
        <motion.circle
          cx="12%"
          cy="78%"
          r="88"
          fill="none"
          stroke="rgba(255,255,255,0.28)"
          strokeWidth="1"
          initial={{ scale: 0.85, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.2 }}
        />
        <motion.circle
          cx="88%"
          cy="22%"
          r="120"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="1"
          initial={{ scale: 0.85, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, delay: 0.3 }}
        />
        <motion.circle
          cx="88%"
          cy="22%"
          r="72"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
          strokeDasharray="6 10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.45 }}
        />
      </svg>

      {/* Floating soft orbs */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-white/45 blur-3xl dark:bg-[#ff6a00]/20"
        animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.12, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 top-6 h-64 w-64 rounded-full bg-[#ff6a00]/25 blur-3xl dark:bg-[#ff8c42]/20"
        animate={{ opacity: [0.25, 0.5, 0.25], y: [0, 18, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-white/35 blur-2xl dark:bg-white/10"
        animate={{ opacity: [0.2, 0.45, 0.2], x: [0, 24, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-6 md:max-w-none">
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mx-auto max-w-2xl text-center"
        >
          <motion.div
            variants={fadeUp}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/45 bg-white/25 px-3.5 py-1.5 text-xs font-semibold tracking-[0.16em] text-[#5c3310]/80 uppercase backdrop-blur-md dark:border-white/15 dark:bg-white/10 dark:text-white/80"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff6a00] shadow-[0_0_0_4px_rgba(255,106,0,0.18)] dark:shadow-[0_0_0_4px_rgba(255,106,0,0.28)]" />
            Get ORYNO
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="mt-5 text-3xl font-bold tracking-tight text-[#2a1708] sm:text-4xl lg:text-[2.75rem] dark:text-white"
          >
            Available on iOS and Android.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#5c3310]/80 sm:text-lg dark:text-white/70"
          >
            Download ORYNO and manage airtime, data, bills, virtual numbers, and
            more — all from one premium app.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mx-auto mt-9 max-w-xl rounded-[28px] border border-white/50 bg-white/35 p-4 shadow-[0_20px_60px_rgba(92,51,16,0.12)] backdrop-blur-xl sm:p-5 dark:border-white/12 dark:bg-white/8 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
          >
            <StoreButtons
              size="large"
              variant="default"
              className="w-full justify-center dark:[&_.store-badge]:border-white/15 dark:[&_.store-badge]:bg-white/10 dark:[&_.store-badge]:text-white dark:[&_.store-badge:hover]:bg-white/16 dark:[&_h4]:text-white dark:[&_p]:text-white/70 dark:[&_svg.fill-foreground]:fill-white"
            />
          </motion.div>

          <motion.p
            variants={fadeUp}
            className="mt-5 text-sm font-medium text-[#5c3310]/65 dark:text-white/55"
          >
            Free to download · Secure wallet · Built for Africa
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
