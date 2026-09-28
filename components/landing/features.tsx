"use client";

import type { LucideIcon } from "lucide-react";
import {
  FileText,
  Gift,
  Link2,
  Phone,
  TrendingUp,
  Trophy,
  Tv,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { fadeUp, stagger } from "./motion";

type FeatureItem = {
  icon: LucideIcon | typeof GiftCardIcon;
  title: string;
  description: string;
  badge?: string;
};

const features: FeatureItem[] = [
  {
    icon: GiftCardIcon,
    title: "Buy Gift Cards",
    description:
      "Purchase digital gift cards worldwide across top brands with live rates directly from your wallet.",
    badge: "50+ Brands",
  },
  {
    icon: Phone,
    title: "Virtual Numbers",
    description:
      "Get temporary or rental numbers across multiple countries for instant SMS verification.",
    badge: "Hot",
  },
  {
    icon: TrendingUp,
    title: "Social Boosting",
    description:
      "Grow your online presence with followers, likes, and engagement across Instagram, TikTok, YouTube, and X.",
    badge: "Most Popular",
  },
  {
    icon: FileText,
    title: "Free Invoices",
    description:
      "Create and download polished, professional PDF invoices with custom line items, tax, and discount options.",
    badge: "Free",
  },
  {
    icon: Link2,
    title: "Payment Links",
    description:
      "Generate standalone checkout payment links to collect deposits, fees, and retainers from clients effortlessly.",
    badge: "Instant",
  },
  {
    icon: Zap,
    title: "Electricity Bills",
    description:
      "Pay prepaid and postpaid meters across major power discos and receive recharge tokens instantly.",
    badge: "All Discos",
  },
  {
    icon: Tv,
    title: "TV Subscriptions",
    description:
      "Renew DStv, GOtv, StarTimes, and cable TV packages in just a few taps without leaving your home.",
    badge: "Cable TV",
  },
  {
    icon: Trophy,
    title: "Betting Funding",
    description:
      "Fund Bet9ja, SportyBet, 1xBet, BetKing, and other top bookmakers directly from your balance.",
    badge: "Instant",
  },
  {
    icon: Gift,
    title: "International Gifting",
    description:
      "Send thoughtful gifts, packages, and cards to friends and loved ones abroad with personalized notes.",
    badge: "Worldwide",
  },
];

export function Features() {
  return (
    <section id="features" className="surface-white py-24 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 md:max-w-none">
        <motion.div
          className="max-w-2xl"
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.p variants={fadeUp} className="eyebrow">
            Everything in one place
          </motion.p>
          <motion.h2 variants={fadeUp} className="section-title">
            Digital services, without the clutter.
          </motion.h2>
          <motion.p variants={fadeUp} className="section-copy">
            ORYNO brings everyday digital needs into a single, premium
            experience — fast, reliable, and built to streamline your digital
            lifestyle.
          </motion.p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.05,
                  ease: [0.22, 1, 0.36, 1],
                }}
                whileHover={{ y: -6 }}
                className="feature-tile group"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="icon-tile transition-transform duration-300 group-hover:scale-110 group-hover:bg-oryno-orange-muted">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  {feature.badge ? (
                    <span className="rounded-full bg-oryno-orange-muted px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                      {feature.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
