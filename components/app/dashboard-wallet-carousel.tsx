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


/** Gap between mobile swipe slides (matches Tailwind gap-3). */
const MOBILE_GAP_PX = 12;

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
  function slideStride(el: HTMLDivElement) {
    return el.clientWidth + MOBILE_GAP_PX;
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
    <div className="flex items-center justify-between pt-0.5 md:hidden">
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

  const fundBtn =
    "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white/20 text-[13px] font-bold text-white ring-1 ring-white/30 backdrop-blur-sm transition hover:bg-white/28";
  const convertBtn =
    "inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-black/20 text-[13px] font-bold text-white ring-1 ring-white/25 backdrop-blur-md transition hover:bg-black/30";

  return (
    <div className={cn(className)}>
      <div
        ref={pagerRef}
        onScroll={onScroll}
        className={cn(
          "flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "md:grid md:grid-cols-2 md:items-stretch md:gap-2.5 md:overflow-visible md:snap-none",
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Local */}
        <div
          className={cn(
            "box-border w-full min-w-full max-w-full shrink-0 basis-full snap-start snap-always",
            "md:min-w-0 md:max-w-none md:basis-auto md:snap-none",
          )}
        >
          <div className="relative isolate overflow-hidden rounded-[18px]">
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
              className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/18 to-transparent"
            />

            <div className="relative flex flex-col gap-2 p-3.5 text-white sm:gap-2.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">
                  ORYNO
                </p>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white/95 ring-1 ring-white/20">
                  LOCAL WALLET
                </span>
              </div>

              <p className="text-sm font-semibold tracking-wide sm:text-[15px]">
                {localCurrency} Wallet {country.flagEmoji}
              </p>

              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-medium tracking-[0.14em] text-white/70 uppercase">
                    Available balance
                  </p>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={hidden ? "h" : localBalance}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      className="mt-0.5 truncate text-xl font-bold tracking-tight sm:text-2xl"
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
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/fund" className={fundBtn}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Fund Wallet
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/convert" className={convertBtn}>
                    <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.25} />
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
          <div className="relative isolate overflow-hidden rounded-[18px] bg-[#1C1C1E] ring-1 ring-white/10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(255,106,0,0.18),transparent_45%)]" />

            <div className="relative flex flex-col gap-2 p-3.5 text-white sm:gap-2.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold tracking-[0.2em] text-white/90 uppercase">
                  ORYNO
                </p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white/90 ring-1 ring-white/15">
                  USD WALLET
                </span>
              </div>

              <p className="text-sm font-semibold tracking-wide sm:text-[15px]">
                USD Wallet 🌐
              </p>

              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[9px] font-medium tracking-[0.14em] text-white/65 uppercase">
                    Available balance
                  </p>
                  <p className="mt-0.5 truncate text-xl font-bold tracking-tight sm:text-2xl">
                    {hidden ? "••••••••" : usdFormatted}
                  </p>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setHidden((v) => !v)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20"
                  aria-label={hidden ? "Show balance" : "Hide balance"}
                >
                  {hidden ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </motion.button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/cards" className={fundBtn}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Cards
                  </Link>
                </motion.div>
                <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}>
                  <Link href="/convert?direction=to_local" className={convertBtn}>
                    <ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={2.25} />
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
