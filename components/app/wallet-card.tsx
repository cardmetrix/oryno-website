"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Wifi,
} from "lucide-react";
import { activeCountryConfig } from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

type WalletCardProps = {
  currency?: string;
  balance?: string;
  accountNumber?: string;
  bankName?: string;
  holderName?: string;
  className?: string;
};

const countryFlags: Record<string, string> = {
  NG: "🇳🇬",
  GH: "🇬🇭",
  ZA: "🇿🇦",
  KE: "🇰🇪",
};

function formatCardNumber(raw: string, hidden: boolean) {
  const digits = raw.replace(/\D/g, "").padStart(10, "0").slice(-10);
  const groups = [
    "••••",
    "••••",
    digits.slice(0, 2) + "••",
    digits.slice(-4),
  ];
  if (hidden) return "••••  ••••  ••••  ••••";
  return `${groups[0]}  ${groups[1]}  ${groups[2]}  ${groups[3]}`;
}

export function WalletCard({
  currency,
  balance = "₦1,245,600.00",
  accountNumber = "1045920394",
  bankName = "Kuda",
  holderName,
  className,
}: WalletCardProps) {
  const { user } = useUser();
  const { code, name: countryName, currency: currencyCode } =
    activeCountryConfig;
  const flag = countryFlags[code] ?? "🌍";
  const walletLabel = currency ?? `${currencyCode} Wallet`;
  const displayHolder =
    holderName ||
    user?.fullName ||
    user?.firstName ||
    (typeof user?.unsafeMetadata?.fullName === "string"
      ? user.unsafeMetadata.fullName
      : null) ||
    "ORYNO MEMBER";
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard?.writeText(accountNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <motion.div
        whileHover={{ y: -3, rotateX: 1.5 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        style={{ perspective: 1200 }}
        className="relative"
      >
        {/* Soft ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 rounded-[36px] bg-[radial-gradient(ellipse_at_30%_20%,rgba(255,106,0,0.28),transparent_55%),radial-gradient(ellipse_at_80%_90%,rgba(255,106,0,0.12),transparent_50%)] blur-xl"
        />

        <div className="relative overflow-hidden rounded-[26px] shadow-[0_24px_60px_rgba(0,0,0,0.45)] ring-1 ring-white/10 sm:rounded-[28px]">
          {/* Dark premium metal face */}
          <div className="relative aspect-[1.68/1] min-h-[210px] w-full overflow-hidden bg-[#141416] text-white sm:min-h-[230px]">
            <div className="absolute inset-0 bg-[linear-gradient(145deg,#1f1f22_0%,#121214_42%,#0c0c0e_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_20%,rgba(255,106,0,0.14)_48%,transparent_72%)]" />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)",
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full bg-oryno-orange/25 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-28 -left-10 h-56 w-56 rounded-full bg-white/5 blur-3xl"
            />
            {/* Fine card texture */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.45) 1px, transparent 0)",
                backgroundSize: "16px 16px",
              }}
            />

            <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
              {/* Top row: brand + contactless */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.22em] text-white/55 uppercase">
                    ORYNO
                  </p>
                  <p className="mt-1 text-sm font-semibold tracking-wide text-white">
                    {walletLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/50">
                    {flag} {countryName} · Premium
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-oryno-orange/20 px-2.5 py-1 text-[10px] font-bold tracking-wide text-oryno-orange ring-1 ring-oryno-orange/35">
                    PREMIUM
                  </span>
                  <motion.span
                    animate={{ opacity: [0.55, 1, 0.55] }}
                    transition={{
                      duration: 2.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/15"
                    aria-hidden="true"
                  >
                    <Wifi className="h-4 w-4 rotate-90 text-white/80" />
                  </motion.span>
                </div>
              </div>

              {/* Chip + balance */}
              <div className="mt-5 flex items-end justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* EMV chip */}
                  <div
                    aria-hidden="true"
                    className="relative h-10 w-[46px] overflow-hidden rounded-[8px] bg-[linear-gradient(145deg,#f0d78c_0%,#c9a227_45%,#a8841a_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_6px_14px_rgba(0,0,0,0.35)] sm:h-11 sm:w-[52px]"
                  >
                    <div className="absolute inset-[3px] rounded-[5px] border border-black/20" />
                    <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-black/25" />
                    <div className="absolute top-0 bottom-0 left-1/3 w-px bg-black/25" />
                    <div className="absolute top-0 bottom-0 left-2/3 w-px bg-black/25" />
                  </div>
                  <div>
                    <p className="text-[10px] font-medium tracking-[0.16em] text-white/45 uppercase">
                      Available
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={hidden ? "hidden" : "visible"}
                        initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
                        transition={{ duration: 0.22 }}
                        className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-white sm:text-[1.85rem]"
                      >
                        {hidden ? "••••••••" : balance}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/15 backdrop-blur-md"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-4 w-4 text-white/80" />
                  ) : (
                    <Eye className="h-4 w-4 text-white/80" />
                  )}
                </motion.button>
              </div>

              {/* Embossed card number */}
              <div className="mt-5">
                <p className="font-mono text-[15px] tracking-[0.22em] text-white/90 sm:text-base sm:tracking-[0.28em]">
                  {formatCardNumber(accountNumber, hidden)}
                </p>
              </div>

              {/* Footer row */}
              <div className="mt-4 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[9px] font-medium tracking-[0.18em] text-white/40 uppercase">
                    Card holder
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold tracking-[0.14em] text-white/90 uppercase">
                    {displayHolder}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-medium tracking-[0.18em] text-white/40 uppercase">
                    Bank
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-white/90">
                    {bankName}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="bg-gradient-to-br from-[#ff8a2b] via-oryno-orange to-[#c24e00] bg-clip-text text-lg font-black tracking-tight text-transparent">
                    O
                  </span>
                  <span className="text-[9px] font-bold tracking-[0.2em] text-white/55">
                    {currencyCode}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account strip + actions under the premium card */}
      <div className="flex flex-wrap items-center gap-2 px-0.5">
        <span className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-[var(--shadow-soft)]">
          Acc · {hidden ? "••••••••" : accountNumber} · {bankName}
        </span>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-[var(--shadow-soft)]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-primary" />
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

      <div className="grid grid-cols-2 gap-3">
        <motion.div
          whileHover={{ y: -3, scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
        >
          <Link
            href="/fund"
            className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[16px] bg-oryno-charcoal text-sm font-bold text-white shadow-[0_12px_28px_rgba(28,28,30,0.28)] ring-1 ring-black/10"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
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
            className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-border bg-background text-sm font-bold text-foreground shadow-[var(--shadow-soft)] transition-colors hover:bg-muted"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted transition-transform group-hover:scale-110">
              <ArrowUpRight className="h-4 w-4" strokeWidth={2.25} />
            </span>
            Withdraw
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
