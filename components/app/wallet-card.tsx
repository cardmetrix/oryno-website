"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Wallet,
} from "lucide-react";
import { activeCountryConfig } from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

type WalletCardProps = {
  currency?: string;
  balance?: string;
  accountLabel?: string;
  className?: string;
};

const countryFlags: Record<string, string> = {
  NG: "🇳🇬",
  GH: "🇬🇭",
  ZA: "🇿🇦",
  KE: "🇰🇪",
};

export function WalletCard({
  currency,
  balance = "₦1,245,600.00",
  accountLabel = "Acc No: 1045920394 • Kuda",
  className,
}: WalletCardProps) {
  const { code, name: countryName, currency: currencyCode } =
    activeCountryConfig;
  const flag = countryFlags[code] ?? "🌍";
  const walletLabel = currency ?? `${currencyCode} Wallet`;
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard?.writeText("1045920394");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "relative overflow-hidden rounded-[28px] p-[1px] shadow-[0_20px_50px_rgba(255,106,0,0.28)]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-oryno-orange via-[#ff8124] to-oryno-orange-soft" />
      <div className="relative overflow-hidden rounded-[27px] bg-gradient-to-br from-oryno-orange via-[#ff7a14] to-[#ff9a4a] p-6 text-white sm:p-7">
        {/* Atmosphere */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-black/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
            backgroundSize: "18px 18px",
          }}
        />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <motion.span
                animate={{ rotate: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/18 ring-1 ring-white/25 backdrop-blur-md"
              >
                <Wallet className="h-5 w-5" strokeWidth={1.75} />
              </motion.span>
              <div>
                <p className="text-sm font-semibold text-white">{walletLabel}</p>
                <p className="text-xs text-white/75">
                  {flag} {countryName} · {currencyCode}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/20 sm:inline-flex">
                Primary
              </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setHidden((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20 backdrop-blur-md"
                aria-label={hidden ? "Show balance" : "Hide balance"}
              >
                {hidden ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </motion.button>
            </div>
          </div>

          <div className="mt-7">
            <p className="text-xs font-medium tracking-wide text-white/75 uppercase">
              Available Balance
            </p>
            <AnimatePresence mode="wait">
              <motion.p
                key={hidden ? "hidden" : "visible"}
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -6, filter: "blur(4px)" }}
                transition={{ duration: 0.25 }}
                className="mt-1.5 text-3xl font-bold tracking-tight sm:text-[2.5rem]"
              >
                {hidden ? "••••••••" : balance}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/15 px-3 py-1.5 text-xs text-white/90 ring-1 ring-white/10 backdrop-blur-sm">
              {accountLabel}
            </span>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.94 }}
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 backdrop-blur-sm"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </motion.button>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <motion.div
              whileHover={{ y: -3, scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
            >
              <Link
                href="/fund"
                className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[16px] bg-oryno-charcoal text-sm font-bold text-white shadow-[0_12px_28px_rgba(28,28,30,0.28)] ring-1 ring-white/10"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
                />
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full bg-oryno-orange text-white shadow-[0_0_0_3px_rgba(255,106,0,0.25)] transition-transform duration-300 group-hover:rotate-90 group-hover:scale-110">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
                <span className="relative tracking-wide">Fund Wallet</span>
              </Link>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/withdraw"
                className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-white/30 bg-white/12 text-sm font-bold text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:scale-110">
                  <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
                </span>
                Withdraw
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
