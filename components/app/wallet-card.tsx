"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Eye, EyeOff, Plus } from "lucide-react";
import { WalletCardSkeleton } from "@/components/app/wallet-skeleton";
import { BRAND_LOGO_SRC } from "@/components/brand-logo";
import { useCountry } from "@/components/providers/country-provider";
import type { WalletPayload } from "@/lib/wallet-types";
import { cn } from "@/lib/utils";

type WalletCardProps = {
  currency?: string;
  balance?: string;
  className?: string;
  /** When true, skip fetch and use props/demo defaults */
  staticMode?: boolean;
};

export function WalletCard({
  currency,
  balance: balanceProp,
  className,
  staticMode = false,
}: WalletCardProps) {
  const { country } = useCountry();
  const currencyCode = country.currency;

  const [payload, setPayload] = useState<WalletPayload | null>(null);
  const [loading, setLoading] = useState(!staticMode);
  const [hidden, setHidden] = useState(false);

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
  const walletLabel =
    currency ?? `${payload?.primary.currency ?? currencyCode} Wallet`;

  return (
    <div className={cn("space-y-3", className)}>
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="relative"
      >
        <div className="relative overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(255,106,0,0.3)] sm:rounded-[24px]">
          <div className="relative w-full overflow-hidden text-white">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00]" />
            <div className="absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.18)_0%,transparent_42%,rgba(180,60,0,0.22)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,230,180,0.4),transparent_40%)]" />

            <motion.div
              aria-hidden="true"
              animate={{ x: ["-40%", "140%"] }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2.2,
              }}
              className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />

            <div className="relative flex flex-col gap-3 p-3.5 sm:p-4">
              <div className="flex items-center gap-3">
             
                <div className="min-w-0">
                  <p className="text-[11px] font-bold tracking-[0.22em] text-white/90 uppercase">
                    ORYNO
                  </p>
                  <p className="mt-0.5 text-sm font-semibold tracking-wide text-white">
                    {walletLabel}
                  </p>
                </div>
              </div>

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
                      className="mt-0.5 truncate text-xl font-bold tracking-tight text-white sm:text-2xl"
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25 backdrop-blur-md"
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