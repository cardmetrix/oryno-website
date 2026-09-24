"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { GiftCardIcon } from "@/components/icons/gift-card-icon";

type IconType = LucideIcon | typeof GiftCardIcon;

type ServiceActionCardProps = {
  href: string;
  label: string;
  icon: IconType;
  index?: number;
  accent?: string;
  /** Compact tiles for dashboard Quick Actions */
  size?: "default" | "sm";
};

export function ServiceActionCard({
  href,
  label,
  icon: Icon,
  index = 0,
  accent = "#FF6A00",
  size = "default",
}: ServiceActionCardProps) {
  const compact = size === "sm";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.045, 0.35),
        duration: 0.4,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: compact ? -2 : -4, scale: compact ? 1.01 : 1.02 }}
      whileTap={{ scale: 0.97 }}
      className="h-full"
    >
      <Link
        href={href}
        className={
          compact
            ? "group flex h-full flex-col items-center justify-center gap-1.5 px-0.5 py-1 text-center"
            : "group flex h-full flex-col items-center justify-center gap-2.5 px-1 py-2 text-center sm:gap-3 sm:py-3"
        }
      >
        <motion.span
          className={
            compact
              ? "flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_6px_14px_rgba(0,0,0,0.12)] ring-1 ring-white/20 sm:h-12 sm:w-12"
              : "flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_22px_rgba(0,0,0,0.16)] ring-1 ring-white/20 sm:h-16 sm:w-16"
          }
          style={{
            background: `linear-gradient(145deg, ${accent}, #e85d00)`,
          }}
          whileHover={{ rotate: [-2, 2, 0] }}
          transition={{ duration: 0.45 }}
        >
          <Icon
            className={compact ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7"}
            strokeWidth={1.75}
          />
        </motion.span>

        <p
          className={
            compact
              ? "text-[11px] leading-tight font-bold tracking-tight text-foreground sm:text-xs"
              : "text-[13px] leading-tight font-bold tracking-tight text-foreground sm:text-sm"
          }
        >
          {label}
        </p>
      </Link>
    </motion.div>
  );
}
