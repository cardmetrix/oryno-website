"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Sparkles,
  Wifi,
} from "lucide-react";
import { WalletCardSkeleton } from "@/components/app/wallet-skeleton";
import { useCountry } from "@/components/providers/country-provider";
import type { WalletPayload } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

type WalletCardProps = {
  currency?: string;
  balance?: string;
  accountNumber?: string;
  bankName?: string;
  holderName?: string;
  className?: string;
  /** When true, skip fetch and use props/demo defaults */
  staticMode?: boolean;
};

function formatCardNumber(raw: string, hidden: boolean) {
  const digits = raw.replace(/\D/g, "").padStart(10, "0").slice(-10);
  if (hidden) return "••••  ••••  ••••";
  return `${digits.slice(0, 4)}  ${digits.slice(4, 8)}  ${digits.slice(8)}`;
}

export function WalletCard({
  currency,
  balance: balanceProp,
  accountNumber: accountProp,
  bankName: bankProp = "ORYNO",
  holderName,
  className,
  staticMode = false,
}: WalletCardProps) {
  const { user } = useUser();
  const { country } = useCountry();
  const currencyCode = country.currency;
  const flag = country.flagEmoji;

  const [payload, setPayload] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(!staticMode);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (staticMode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/wallet", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const json = (await res.json()) as WalletPayload;
        if (!cancelled) setPayload(json);
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [staticMode]);

  if (loading) {
    return <WalletCardSkeleton className={className} />;
  }

  const balance =
    balanceProp ?? payload?.primary.balanceFormatted ?? "₦0.00";
  const cardNumber =
    accountProp ?? payload?.primary.cardNumber ?? "8000000000";
  const walletLabel =
    currency ?? `${payload?.primary.currency ?? currencyCode} Wallet`;
  const displayHolder =
    holderName ||
    payload?.user.fullName ||
    user?.fullName ||
    user?.firstName ||
    "ORYNO MEMBER";
  const displayCurrency = payload?.primary.currency ?? currencyCode;

  function handleCopy() {
    void navigator.clipboard?.writeText(cardNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="relative"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 rounded-[36px] bg-[radial-gradient(ellipse_at_25%_15%,rgba(255,129,36,0.45),transparent_55%),radial-gradient(ellipse_at_85%_90%,rgba(255,106,0,0.28),transparent_50%)] blur-xl"
        />

        <div className="relative overflow-hidden rounded-[26px] shadow-[0_24px_50px_rgba(255,106,0,0.32)] ring-1 ring-white/25 sm:rounded-[28px]">
          <div className="relative min-h-[210px] w-full overflow-hidden text-white sm:min-h-[200px] sm:aspect-[1.72/1] md:aspect-[1.95/1] md:min-h-[168px] lg:aspect-[1.72/1] lg:min-h-[200px]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00]" />
            <div className="absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.18)_0%,transparent_42%,rgba(180,60,0,0.22)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,230,180,0.45),transparent_40%)]" />

            <motion.div
              aria-hidden="true"
              animate={{ x: ["-40%", "140%"] }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2.2,
              }}
              className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
            />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-16 -right-10 h-44 w-44 rounded-full border border-white/25"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-20 -left-14 h-48 w-48 rounded-full border border-white/10"
            />

            <div className="relative flex h-full flex-col justify-between p-4 sm:p-5 md:p-4 lg:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-black/25 text-lg font-black tracking-tight text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-white/25 backdrop-blur-md">
                    O
                    <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-[#ffd29a] ring-2 ring-[#b84300]" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] font-bold tracking-[0.22em] text-white/90 uppercase">
                        ORYNO
                      </p>
                      <Sparkles className="h-3 w-3 text-[#ffd29a]" />
                    </div>
                    <p className="mt-0.5 text-sm font-semibold tracking-wide text-white">
                      {walletLabel} {flag}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-[18px] border border-white/15 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md md:mt-2.5 md:p-2.5 lg:mt-3 lg:p-3">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium tracking-[0.16em] text-white/65 uppercase">
                      Available balance
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={hidden ? "hidden" : balance}
                        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                        transition={{ duration: 0.22 }}
                        className="mt-0.5 truncate text-xl font-bold tracking-tight text-white sm:text-2xl md:text-[1.35rem] lg:text-[1.85rem]"
                      >
                        {hidden ? "••••••••" : balance}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => setHidden((v) => !v)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-md"
                    aria-label={hidden ? "Show balance" : "Hide balance"}
                  >
                    {hidden ? (
                      <EyeOff className="h-4 w-4 text-white" />
                    ) : (
                      <Eye className="h-4 w-4 text-white" />
                    )}
                  </motion.button>
                </div>
              </div>

              <div className="mt-3 flex items-end justify-between gap-3 md:mt-2 lg:mt-3">
                <div className="min-w-0">
                  <p className="font-mono text-[14px] tracking-[0.2em] text-white sm:text-[15px] sm:tracking-[0.24em] md:text-[13px] lg:text-base lg:tracking-[0.28em]">
                    {formatCardNumber(cardNumber, hidden)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="truncate text-[10px] font-semibold tracking-[0.14em] text-white/85 uppercase">
                      {displayHolder}
                    </p>
                    <span className="h-1 w-1 rounded-full bg-white/40" />
                    <p className="text-[10px] font-medium text-white/70">
                      {bankProp}
                    </p>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-white/20"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-[#ffd29a]" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end">
                  <span className="rounded-md bg-black/25 px-2 py-1 text-[10px] font-bold tracking-[0.18em] text-[#ffd29a] ring-1 ring-white/15">
                    {displayCurrency}
                  </span>
                  <span className="mt-1 text-[9px] font-medium tracking-[0.16em] text-white/60 uppercase">
                     card
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/fund"
            className="group relative flex h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] px-3 text-sm font-bold text-black shadow-[0_14px_32px_rgba(255,106,0,0.35)] ring-1 ring-white/20"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_30%,rgba(255,255,255,0.22)_50%,transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-black/10 ring-1 ring-black/15 backdrop-blur-sm transition-transform duration-300 group-hover:rotate-90">
              <Plus className="h-4 w-4 text-black" strokeWidth={2.5} />
            </span>
            <span className="relative tracking-wide text-black">Fund</span>
          </Link>
        </motion.div>

        <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/withdraw"
            className="group relative flex h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-[18px] bg-[#1a120c] px-3 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,0,0,0.28)] ring-1 ring-white/10"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,106,0,0.28),transparent_55%)] opacity-80"
            />
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-transform duration-300 group-hover:scale-110">
              <ArrowUpRight className="h-4 w-4 text-white" strokeWidth={2.25} />
            </span>
            <span className="relative tracking-wide text-white">Withdraw</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
