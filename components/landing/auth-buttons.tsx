"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AUTH_LINKS } from "@/lib/auth-links";
import { cn } from "@/lib/utils";

type AuthButtonsProps = {
  className?: string;
  size?: "default" | "large";
  /** row = side by side, stack = always full-width column, responsive = stack on mobile / row on sm+ */
  layout?: "row" | "stack" | "responsive";
  onNavigate?: () => void;
};

export function AuthButtons({
  className,
  size = "default",
  layout = "row",
  onNavigate,
}: AuthButtonsProps) {
  const isLarge = size === "large";
  const stacked = layout === "stack";
  const responsive = layout === "responsive";

  return (
    <div
      className={cn(
        "flex",
        stacked && "w-full flex-col gap-2.5",
        responsive && "w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center",
        layout === "row" && "flex-row items-center gap-2.5",
        className,
      )}
    >
      <motion.div
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          stacked && "w-full",
          responsive && "w-full sm:w-auto",
        )}
      >
        <Link
          href={AUTH_LINKS.signIn}
          onClick={onNavigate}
          className={cn(
            "btn-secondary",
            stacked && "w-full",
            responsive && "w-full sm:w-auto",
            isLarge ? "px-5 py-3 text-base" : "px-4 py-2.5 text-sm",
          )}
        >
          Sign in
        </Link>
      </motion.div>

      <motion.div
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          stacked && "w-full",
          responsive && "w-full sm:w-auto",
        )}
      >
        <Link
          href={AUTH_LINKS.getStarted}
          onClick={onNavigate}
          className={cn(
            "btn-primary",
            stacked && "w-full",
            responsive && "w-full sm:w-auto",
            isLarge ? "px-5 py-3 text-base" : "px-4 py-2.5 text-sm",
          )}
        >
          Get started
        </Link>
      </motion.div>
    </div>
  );
}
