"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

const promos = [
  {
    emoji: "🎁",
    title: "Buy & Sell Gift Cards",
    subtitle: "Amazon, Apple, Steam and more — launching soon",
    href: "/services/gift-cards",
    tone: "from-oryno-orange to-oryno-orange-soft",
  },
  {
    emoji: "🌍",
    title: "New Virtual Numbers Available",
    subtitle: "Buy or rent SMS lines for verification worldwide",
    href: "/services/virtual-numbers",
    tone: "from-oryno-charcoal to-[#2a2a2e]",
  },
  {
    emoji: "🎉",
    title: "Cashback on bill payments",
    subtitle: "Earn rewards when you pay electricity & TV bills",
    href: "/services/bills",
    tone: "from-[#ff7a1a] to-oryno-orange",
  },
];

export function PromoBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % promos.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, []);

  const promo = promos[index];

  return (
    <div className="relative overflow-hidden rounded-[22px] shadow-[var(--shadow-soft)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={promo.title}
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -28 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={`relative bg-gradient-to-r ${promo.tone} px-5 py-4 text-white`}
        >
          <Link href={promo.href} className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl ring-1 ring-white/20 backdrop-blur-sm">
              {promo.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold tracking-tight sm:text-base">
                {promo.title}
              </p>
              <p className="mt-0.5 truncate text-xs text-white/85 sm:text-sm">
                {promo.subtitle}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 opacity-90" />
          </Link>
        </motion.div>
      </AnimatePresence>

      <div className="absolute right-3 bottom-2 flex gap-1.5">
        {promos.map((item, i) => (
          <button
            key={item.title}
            type="button"
            aria-label={`Show promo ${i + 1}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? "w-4 bg-white" : "w-1.5 bg-white/45"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
