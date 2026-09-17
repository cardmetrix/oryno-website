"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Menu } from "lucide-react";
import { useProfileDisplay } from "@/hooks/use-profile-display";
import { NotificationDropdown } from "./notification-dropdown";
import { ServiceSearch } from "./service-search";
import { useMobileNav } from "./mobile-nav-context";

export function DashboardHeader() {
  const { display, firstName } = useProfileDisplay();
  const { toggle } = useMobileNav();

  return (
    <motion.header
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="sticky top-3 z-30 mb-6 w-full rounded-[28px] border border-border/80 bg-background/90 px-4 py-3.5 shadow-[var(--shadow-soft)] backdrop-blur-xl sm:top-4 sm:px-5 sm:py-4 dark:border-border dark:bg-popover/90"
    >
      <div className="flex w-full flex-nowrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border bg-muted/60 text-foreground shadow-[var(--shadow-soft)] transition hover:bg-muted md:hidden dark:bg-muted dark:hover:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>

          <Link
            href="/profile"
            aria-label="Open profile"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] transition hover:opacity-90 sm:gap-3"
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-oryno-orange-muted sm:h-11 sm:w-11">
              {display?.avatarUrl ? (
                <Image
                  src={display.avatarUrl}
                  alt={display.fullName}
                  fill
                  className="object-cover"
                  sizes="44px"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary sm:text-sm">
                  {display?.initials ?? "OR"}
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
                Welcome back, {firstName} 👋
              </span>
            </span>
          </Link>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ServiceSearch className="hidden min-w-[200px] md:block lg:min-w-[240px]" />
          <NotificationDropdown />
        </div>
      </div>
    </motion.header>
  );
}
