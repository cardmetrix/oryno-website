"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Eye, EyeOff, Plus } from "lucide-react";
import { WalletCardSkeleton } from "@/components/app/wallet-skeleton";
import { WalletBalanceAmount } from "@/components/app/wallet-balance-amount";
import { useCountry } from "@/components/providers/country-provider";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";

const LOCAL_HINT: Record<string, string> = {
  NG: "Use your NGN balance for airtime, data, bills, betting and other Nigerian services.",
  GH: "Use your GHS balance for airtime, data, bills, betting and other Ghanaian services.",
  KE: "Use your KES balance for airtime, data, bills, betting and other Kenyan services.",
  ZA: "Use your ZAR balance for airtime, data, bills and other South African services.",
};

type Props = { className?: string };

/** Dashboard wallets: swipe one-at-a-time on mobile; both side-by-side from md. */
export function DashboardWalletCarousel({ className }: Props) {
  const { country } = useCountry();
  const { data, isLoading } = useWallet();
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<"local" | "usd">("local");
  const pagerRef = useRef<HTMLDivElement>(null);

  if (isLoading && !data) {
    return <WalletCardSkeleton className={className} />;
  }

  const localCurrency = data?.primary.currency ?? country.currency;
  const localBalance = data?.primary.balance ?? "0";
  const usdFormatted = data?.usd?.balanceFormatted ?? "$0.00";
  const hint =
    LOCAL_HINT[country.code] ??
    `Use your ${localCurrency} balance for local services in ${country.name}.`;

  function onScroll() {
    const el = pagerRef.current;
    if (!el) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const idx = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    setView(idx >= 1 ? "usd" : "local");
  }

  function scrollTo(target: "local" | "usd") {
    const el = pagerRef.current;
    if (!el) return;
    if (window.matchMedia("(min-width: 768px)").matches) {
      setView(target);
      return;
    }
    el.scrollTo({
      left: target === "usd" ? el.clientWidth : 0,
      behavior: "smooth",
    });
    setView(target);
  }

  const footer = (
    <div className="flex items-center justify-between pt-1 md:hidden">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Local wallet"
          onClick={() => scrollTo("local")}
          className={cn(
            "h-1.5 rounded-full transition-all",
            view === "local" ? "w-5 bg-white" : "w-1.5 bg-white/35",
          )}
        />
        <button
          type="button"
          aria-label="USD wallet"
          onClick={() => scrollTo("usd")}
          className={cn(
            "h-1.5 rounded-full transition-all",
            view === "usd" ? "w-5 bg-white" : "w-1.5 bg-white/35",
          )}
        />
      </div>
      <AnimatePresence mode="wait">
        <motion.button
          key={view}
          type="button"
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          onClick={() => scrollTo(view === "local" ? "usd" : "local")}
          className="text-[11px] font-semibold text-white/75"
        >
          {view === "local" ? "Swipe for USD ›" : "‹ Local wallet"}
        </motion.button>
      </AnimatePresence>
    </div>
  );

  return (
    <div className={cn(className)}>
      <div
        ref={pagerRef}
        onScroll={onScroll}
        className={cn(
          "flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:grid md:grid-cols-2 md:items-stretch md:gap-4 md:overflow-visible md:snap-none",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Local — full-bleed slide on mobile */}
        <div
          className={cn(
            "box-border w-full min-w-full max-w-full shrink-0 basis-full snap-start snap-always",
            "md:min-w-0 md:max-w-none md:basis-auto md:snap-none",
          )}
        >
          <div className="relative isolate overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(255,106,0,0.28)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00]" />
            <div className="absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.18)_0%,transparent_42%,rgba(180,60,0,0.22)_100%)]" />
            <motion.div
              aria-hidden
              animate={{ x: ["-35%", "135%"] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2.2,
              }}
              className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/22 to-transparent"
            />

            <div className="relative flex flex-col gap-3 p-4 text-white sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold tracking-[0.22em] text-white/90 uppercase">
                  ORYNO
                </p>
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/95 ring-1 ring-white/20">
                  LOCAL WALLET
                </span>
              </div>

              <p className="text-base font-semibold tracking-wide">
                {localCurrency} Wallet {country.flagEmoji}
              </p>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium tracking-[0.16em] text-white/70 uppercase">
                    Available balance
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={hidden ? "h" : localBalance}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-0.5 truncate text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      <WalletBalanceAmount
                        balance={localBalance}
                        currency={localCurrency}
                        countryCode={country.code}
                        hidden={hidden}
                      />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </motion.button>
              </div>

              <p className="text-xs leading-relaxed text-white/80">{hint}</p>

              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/fund"
                    className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white text-sm font-bold text-black shadow-[0_8px_20px_rgba(0,0,0,0.12)]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Fund Wallet
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/convert"
                    className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-black/25 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur-md"
                  >
                    <ArrowLeftRight className="h-4 w-4" strokeWidth={2.25} />
                    Convert to USD
                  </Link>
                </motion.div>
              </div>

              {footer}
            </div>
          </div>
        </div>

        {/* USD */}
        <div
          className={cn(
            "box-border w-full min-w-full max-w-full shrink-0 basis-full snap-start snap-always",
            "md:min-w-0 md:max-w-none md:basis-auto md:snap-none",
          )}
        >
          <div className="relative isolate overflow-hidden rounded-[22px] bg-[#1C1C1E] shadow-[0_18px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,106,0,0.22),transparent_45%)]" />

            <div className="relative flex flex-col gap-3 p-4 text-white sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[11px] font-bold tracking-[0.22em] text-white/90 uppercase">
                  ORYNO
                </p>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white/90 ring-1 ring-white/15">
                  USD WALLET
                </span>
              </div>

              <p className="text-base font-semibold tracking-wide">
                USD Wallet 🌐
              </p>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium tracking-[0.16em] text-white/65 uppercase">
                    Available balance
                  </p>
                  <p className="mt-0.5 truncate text-2xl font-bold tracking-tight sm:text-3xl">
                    {hidden ? "••••••••" : usdFormatted}
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </motion.button>
              </div>

              <p className="text-xs leading-relaxed text-white/70">
                Use your USD balance for gift cards, international virtual
                numbers and more.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/wallet?view=usd&panel=fund"
                    className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white text-sm font-bold text-black shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                    Fund Wallet
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/convert?direction=to_local"
                    className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/20"
                  >
                    <ArrowLeftRight className="h-4 w-4" strokeWidth={2.25} />
                    Convert
                  </Link>
                </motion.div>
              </div>

              {footer}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
