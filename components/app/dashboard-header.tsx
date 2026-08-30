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
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="sticky top-0 z-30 -mx-4 mb-6 border-b border-border/70 bg-[image:var(--header-surface)] px-4 py-3.5 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggle}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] transition hover:bg-muted md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>

          <Link
            href="/profile"
            aria-label="Open profile"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[14px] transition hover:opacity-90 sm:gap-3"
          >
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-oryno-orange-muted sm:h-11 sm:w-11">
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
