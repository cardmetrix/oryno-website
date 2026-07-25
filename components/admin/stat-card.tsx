"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string;
  change?: string;
  up?: boolean;
  delay?: number;
  className?: string;
};

export function StatCard({
  label,
  value,
  change,
  up,
  delay = 0,
  className,
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {change ? (
        <p
          className={cn(
            "mt-2 text-xs font-semibold",
            up ? "text-[var(--oryno-success)]" : "text-muted-foreground",
          )}
        >
          {change}
        </p>
      ) : null}
    </motion.div>
  );
}
