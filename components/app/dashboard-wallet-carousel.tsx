"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Eye, EyeOff, Plus } from "lucide-react";
import { WalletBalanceAmount } from "@/components/app/wallet-balance-amount";
import { useCountry } from "@/components/providers/country-provider";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";

/** Gap between swipe slides (matches Tailwind gap-1.5). */
const SLIDE_GAP_PX = 6;

type Props = { className?: string };

/** Dashboard wallets: swipe one-at-a-time on mobile; both side-by-side from md. */
export function DashboardWalletCarousel({ className }: Props) {
  const { country } = useCountry();
  const { data, isLoading } = useWallet();
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<"local" | "usd">("local");
  const pagerRef = useRef<HTMLDivElement>(null);

  if (isLoading && !data) {
    return (
      <div className={cn(className)}>
        <div className="h-[148px] w-full animate-pulse rounded-[20px] bg-muted sm:h-[156px] md:rounded-[22px]" />
      </div>
    );
  }

  const localCurrency = data?.primary.currency ?? country.currency;
  const localBalance = data?.primary.balance ?? "0";
  const usdFormatted = data?.usd?.balanceFormatted ?? "$0.00";

  function slideStride(el: HTMLDivElement) {
    return el.clientWidth + SLIDE_GAP_PX;
  }

  function onScroll() {
    const el = pagerRef.current;
    if (!el) return;
    if (window.matchMedia("(min-width: 768px)").matches) return;
    const idx = Math.round(el.scrollLeft / Math.max(slideStride(el), 1));
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
      left: target === "usd" ? slideStride(el) : 0,
      behavior: "smooth",
    });
    setView(target);
  }

  const footer = (
    <div className="flex items-center justify-between md:hidden">
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Local wallet"
          onClick={() => scrollTo("local")}
          className={cn(
            "h-1 rounded-full transition-all",
            view === "local" ? "w-4 bg-white" : "w-1 bg-white/35",
          )}
        />
        <button
          type="button"
          aria-label="USD wallet"
          onClick={() => scrollTo("usd")}
          className={cn(
            "h-1 rounded-full transition-all",
            view === "usd" ? "w-4 bg-white" : "w-1 bg-white/35",
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
          className="text-[10px] font-semibold text-white/75"
        >
          {view === "local" ? "Swipe for USD ›" : "‹ Local wallet"}
        </motion.button>
      </AnimatePresence>
    </div>
  );

  const localFundBtn =
    "inline-flex h-8 w-full items-center justify-center gap-1 rounded-full bg-white/20 text-[11px] font-bold text-white ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-white/28";
  const localConvertBtn =
    "inline-flex h-8 w-full items-center justify-center gap-1 rounded-full bg-black/20 text-[11px] font-bold text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/30";
  const usdFundBtn =
    "usd-card-btn inline-flex h-8 w-full items-center justify-center gap-1 rounded-full text-[11px] font-bold transition";
  const usdConvertBtn =
    "usd-card-btn-alt inline-flex h-8 w-full items-center justify-center gap-1 rounded-full text-[11px] font-bold transition";

  const slideClass = cn(
    "box-border w-full min-w-full max-w-full shrink-0 basis-full snap-start snap-always",
    "md:min-w-0 md:max-w-none md:basis-auto md:snap-none",
  );
  const cardRadius = "overflow-hidden rounded-[20px] md:rounded-[22px]";

  return (
    <div className={cn("w-full", className)}>
      <div
        ref={pagerRef}
        onScroll={onScroll}
        className={cn(
          "flex w-full snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:grid md:grid-cols-2 md:items-stretch md:gap-1.5 md:overflow-visible md:snap-none",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Local */}
        <div className={slideClass}>
          <div className={cn("relative isolate", cardRadius)}>
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00]" />
            <div className="absolute inset-0 bg-[linear-gradient(210deg,rgba(255,255,255,0.16)_0%,transparent_42%,rgba(180,60,0,0.18)_100%)]" />
            <motion.div
              aria-hidden
              animate={{ x: ["-35%", "135%"] }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2.2,
              }}
              className="pointer-events-none absolute inset-y-0 z-[1] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/18 to-transparent"
            />

            <div className="relative z-[2] flex flex-col gap-1.5 p-2.5 text-white sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold tracking-[0.18em] text-white/90 uppercase">
                    ORYNO
                  </p>
                  <p className="text-[13px] font-semibold tracking-wide">
                    {localCurrency} Wallet
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </motion.button>
              </div>

              <div className="min-w-0">
                <p className="text-[8px] font-medium tracking-[0.12em] text-white/70 uppercase">
                  Available balance
                </p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={hidden ? "h" : localBalance}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    className="truncate text-lg font-extrabold tracking-tight sm:text-xl"
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

              <div className="grid grid-cols-2 gap-3.5">
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/fund" className={localFundBtn}>
                    <Plus className="h-3 w-3" strokeWidth={2.5} />
                    Fund
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/convert" className={localConvertBtn}>
                    <ArrowLeftRight className="h-3 w-3" strokeWidth={2.25} />
                    Convert
                  </Link>
                </motion.div>
              </div>

              {footer}
            </div>
          </div>
        </div>

        {/* USD */}
        <div className={slideClass}>
          <div
            className={cn(
              "usd-card-surface isolate ring-1 ring-[color:var(--usd-card-ring)]",
              cardRadius,
            )}
          >
            <motion.div
              aria-hidden
              animate={{ x: ["-35%", "135%"] }}
              transition={{
                duration: 5.2,
                repeat: Infinity,
                ease: "easeInOut",
                repeatDelay: 2.4,
              }}
              className="pointer-events-none absolute inset-y-0 z-[1] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-[color:var(--usd-card-sheen)] to-transparent"
            />

            <div className="relative z-[2] flex flex-col gap-1.5 p-2.5 sm:p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold tracking-[0.18em] uppercase opacity-90">
                    ORYNO
                  </p>
                  <p className="text-[13px] font-semibold tracking-wide">
                    USD Wallet
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setHidden((v) => !v)}
                  className="usd-card-chip flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-3 w-3" />
                  ) : (
                    <Eye className="h-3 w-3" />
                  )}
                </motion.button>
              </div>

              <div className="min-w-0">
                <p
                  className="text-[8px] font-medium tracking-[0.12em] uppercase"
                  style={{ color: "var(--usd-card-soft)" }}
                >
                  Available balance
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={hidden ? "h" : usdFormatted}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -2 }}
                    className="truncate text-lg font-extrabold tracking-tight sm:text-xl"
                  >
                    {hidden ? "••••••••" : usdFormatted}
                  </motion.p>
                </AnimatePresence>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/cards" className={usdFundBtn}>
                    <Plus className="h-3 w-3" strokeWidth={2.5} />
                    Fund
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/convert?direction=to_local"
                    className={usdConvertBtn}
                  >
                    <ArrowLeftRight className="h-3 w-3" strokeWidth={2.25} />
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
