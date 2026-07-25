"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const ads = [
  {
    id: "gift",
    href: "/services/gift-cards",
    title: "Gift Cards",
    subtitle: "Buy & sell coming soon",
    image: "/brand/auth-panel.jpg",
    overlay: "from-oryno-charcoal/85 via-oryno-charcoal/40 to-transparent",
  },
  {
    id: "boost",
    href: "/services/social",
    title: "Social Boost",
    subtitle: "Grow followers, likes & views",
    image: "/brand/auth-panel.jpg",
    overlay: "from-[#1C1C1E]/90 via-[#FF6A00]/30 to-transparent",
    badge: "Popular",
  },
  {
    id: "numbers",
    href: "/services/virtual-numbers",
    title: "Virtual Numbers",
    subtitle: "SMS verification lines worldwide",
    image: "/brand/auth-panel.jpg",
    overlay: "from-oryno-orange/75 via-oryno-charcoal/45 to-transparent",
  },
];

const INTERVAL_MS = 10_000;

export function AdCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ads.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const ad = ads[index];

  return (
    <div className="relative h-[128px] w-full overflow-hidden rounded-[22px] border border-border/80 bg-muted shadow-[var(--shadow-soft)] sm:h-[148px] md:h-[172px] md:rounded-[28px] lg:h-full lg:min-h-[200px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <Image
            src={ad.image}
            alt={ad.title}
            fill
            className="object-cover object-[center_30%] md:object-center"
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority={index === 0}
          />
          <div
            className={`absolute inset-0 bg-gradient-to-r ${ad.overlay}`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10 md:from-black/25" />

          <Link
            href={ad.href}
            className="group absolute inset-0 flex items-end justify-between gap-3 p-3.5 sm:p-4 md:p-5 lg:p-6"
          >
            <div className="min-w-0 max-w-[88%] md:max-w-[72%]">
              {ad.badge ? (
                <span className="mb-1.5 inline-block rounded-md bg-primary/95 px-2 py-0.5 text-[9px] font-bold tracking-wide text-white uppercase md:mb-2 md:text-[10px]">
                  {ad.badge}
                </span>
              ) : null}
              <p className="truncate text-lg font-bold tracking-tight text-white sm:text-xl md:text-2xl">
                {ad.title}
              </p>
              <p className="mt-0.5 line-clamp-1 text-xs text-white/80 sm:text-sm md:mt-1 md:text-[15px] md:text-white/90">
                {ad.subtitle}
              </p>
              <span className="mt-2.5 hidden items-center gap-1 text-xs font-semibold text-white/95 md:inline-flex">
                Explore
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>

            <span className="mb-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/15 text-white backdrop-blur-sm transition group-hover:border-white/40 group-hover:bg-white/25 md:mb-1 md:flex lg:h-11 lg:w-11">
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </span>
          </Link>
        </motion.div>
      </AnimatePresence>

      {/* Progress */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-black/20 md:h-1">
        <motion.div
          key={`progress-${ad.id}`}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: INTERVAL_MS / 1000, ease: "linear" }}
          className="h-full bg-primary"
        />
      </div>

      {/* Dots — top-right so they never clash with copy/CTA */}
      <div className="absolute top-2.5 right-2.5 flex gap-1 sm:top-3 sm:right-3 md:top-4 md:right-4 md:gap-1.5">
        {ads.map((item, i) => (
          <button
            key={item.id}
            type="button"
            aria-label={`Go to ad ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all md:h-2 ${
              i === index
                ? "w-4 bg-white md:w-5"
                : "w-1.5 bg-white/45 hover:bg-white/70 md:w-2"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
