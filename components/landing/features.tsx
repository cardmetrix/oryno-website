"use client";

import {
  Smartphone,
  Wifi,
  Zap,
  Tv,
  Phone,
  Megaphone,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";
import { fadeUp, stagger } from "./motion";

const features: {
  icon: typeof Smartphone | typeof GiftCardIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: GiftCardIcon,
    title: "Gift Cards",
    description:
      "Sell and buy gift cards with live rates — credit lands in your wallet.",
  },
  {
    icon: Smartphone,
    title: "Airtime",
    description:
      "Top up instantly across local networks in every supported country.",
  },
  {
    icon: Wifi,
    title: "Data Bundles",
    description:
      "Buy data packs from the providers you already use — fast and reliable.",
  },
  {
    icon: Zap,
    title: "Utility Bills",
    description:
      "Pay electricity and essential utilities without leaving the app.",
  },
  {
    icon: Tv,
    title: "TV Subscriptions",
    description: "Renew DStv, GOtv, Startimes and more in a few taps.",
  },
  {
    icon: Phone,
    title: "Virtual Numbers",
    description:
      "Purchase numbers by country for SMS verification and rentals.",
  },
  {
    icon: Mail,
    title: "Rent Email",
    description:
      "Temporary inboxes for OTP and sign-ups — rent a domain and receive codes.",
  },
  {
    icon: Megaphone,
    title: "Social Boosting",
    description:
      "Grow your presence with simple, built-in social media boosting tools.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    description:
      "OTP, device recognition, encrypted APIs, and clear transaction logs.",
  },
];

export function Features() {
  return (
    <section id="features" className="surface-white py-24 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 md:max-w-none md:px-0">
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
            experience — spacious, fast, and built to expand across Africa.
          </motion.p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="icon-tile mb-4 transition-transform duration-300 group-hover:scale-110 group-hover:bg-oryno-orange-muted">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
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
