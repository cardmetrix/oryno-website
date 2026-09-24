"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { LayoutDashboard, Wallet } from "lucide-react";
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
  const { isSignedIn, isLoaded } = useAuth();
  const isLarge = size === "large";
  const stacked = layout === "stack";
  const responsive = layout === "responsive";

  const shell = cn(
    "flex",
    stacked && "w-full flex-col gap-2.5",
    responsive && "w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center",
    layout === "row" && "flex-row items-center gap-2.5",
    className,
  );

  const item = cn(stacked && "w-full", responsive && "w-full sm:w-auto");
  const btnSize = isLarge ? "px-5 py-3 text-base" : "px-4 py-2.5 text-sm";

  if (!isLoaded) {
    return (
      <div className={shell} aria-hidden="true">
        <div
          className={cn(
            "h-11 animate-pulse rounded-[14px] bg-muted",
            item,
            isLarge ? "min-w-[7.5rem]" : "min-w-[5.5rem]",
          )}
        />
        <div
          className={cn(
            "h-11 animate-pulse rounded-[14px] bg-muted/70",
            item,
            isLarge ? "min-w-[8.5rem]" : "min-w-[6.5rem]",
          )}
        />
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className={shell}>
        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={item}>
          <Link
            href="/cards"
            onClick={onNavigate}
            className={cn(
              "btn-secondary inline-flex items-center justify-center gap-2",
              stacked && "w-full",
              responsive && "w-full sm:w-auto",
              btnSize,
            )}
          >
            <Wallet className="h-4 w-4" strokeWidth={1.75} />
            Wallet
          </Link>
        </motion.div>

        <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={item}>
          <Link
            href="/dashboard"
            onClick={onNavigate}
            className={cn(
              "btn-primary inline-flex items-center justify-center gap-2",
              stacked && "w-full",
              responsive && "w-full sm:w-auto",
              btnSize,
            )}
          >
            <LayoutDashboard className="h-4 w-4" strokeWidth={1.75} />
            Open dashboard
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={item}>
        <Link
          href={AUTH_LINKS.signIn}
          onClick={onNavigate}
          className={cn(
            "btn-secondary",
            stacked && "w-full",
            responsive && "w-full sm:w-auto",
            btnSize,
          )}
        >
          Sign in
        </Link>
      </motion.div>

      <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} className={item}>
        <Link
          href={AUTH_LINKS.getStarted}
          onClick={onNavigate}
          className={cn(
            "btn-primary",
            stacked && "w-full",
            responsive && "w-full sm:w-auto",
            btnSize,
          )}
        >
          Get started
        </Link>
      </motion.div>
    </div>
  );
}
