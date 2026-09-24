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

/** Dashboard swipe: local wallet + USD wallet (Phase 1). */
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
    const next = el.scrollLeft > el.clientWidth * 0.4 ? "usd" : "local";
    setView(next);
  }

  function scrollTo(target: "local" | "usd") {
    const el = pagerRef.current;
    if (!el) return;
    el.scrollTo({
      left: target === "usd" ? el.clientWidth : 0,
      behavior: "smooth",
    });
    setView(target);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        ref={pagerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Local */}
        <div className="w-[92%] shrink-0 snap-center sm:w-[88%]">
          <div className="relative overflow-hidden rounded-[22px] shadow-[0_18px_40px_rgba(255,106,0,0.3)]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00]" />
            <div className="absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.18)_0%,transparent_42%,rgba(180,60,0,0.22)_100%)]" />
            <div className="relative space-y-3 p-4 text-white sm:p-5">
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
                <button
                  type="button"
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="text-xs leading-relaxed text-white/80">{hint}</p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Link
                  href="/fund"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/20 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur-sm"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Fund Wallet
                </Link>
                <Link
                  href="/convert"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/20 text-sm font-bold text-white ring-1 ring-white/25 backdrop-blur-sm"
                >
                  <ArrowLeftRight className="h-4 w-4" strokeWidth={2.25} />
                  Convert to USD
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* USD */}
        <div className="w-[92%] shrink-0 snap-center sm:w-[88%]">
          <div className="relative overflow-hidden rounded-[22px] bg-[#1C1C1E] shadow-[0_18px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,106,0,0.22),transparent_45%)]" />
            <div className="relative space-y-3 p-4 text-white sm:p-5">
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
                <button
                  type="button"
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="text-xs leading-relaxed text-white/70">
                Use your USD balance for gift cards, international virtual
                numbers and more.
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Link
                  href="/wallet?view=usd&panel=fund"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/20"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Fund Wallet
                </Link>
                <Link
                  href="/convert?direction=to_local"
                  className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-white/15 text-sm font-bold text-white ring-1 ring-white/20"
                >
                  <ArrowLeftRight className="h-4 w-4" strokeWidth={2.25} />
                  Convert
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex gap-1.5">
          <button
            type="button"
            aria-label="Local wallet"
            onClick={() => scrollTo("local")}
            className={cn(
              "h-2 rounded-full transition-all",
              view === "local" ? "w-5 bg-oryno-orange" : "w-2 bg-muted-foreground/30",
            )}
          />
          <button
            type="button"
            aria-label="USD wallet"
            onClick={() => scrollTo("usd")}
            className={cn(
              "h-2 rounded-full transition-all",
              view === "usd" ? "w-5 bg-oryno-orange" : "w-2 bg-muted-foreground/30",
            )}
          />
        </div>
        <button
          type="button"
          onClick={() => scrollTo(view === "local" ? "usd" : "local")}
          className="text-xs font-semibold text-muted-foreground"
        >
          {view === "local" ? "Swipe for USD ›" : "‹ Local wallet"}
        </button>
      </div>
    </div>
  );
}
