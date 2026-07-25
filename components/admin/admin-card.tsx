"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type AdminCardProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  title?: string;
  action?: React.ReactNode;
};

export function AdminCard({
  children,
  className,
  delay = 0,
  title,
  action,
}: AdminCardProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6",
        className,
      )}
    >
      {title || action ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </motion.section>
  );
}
