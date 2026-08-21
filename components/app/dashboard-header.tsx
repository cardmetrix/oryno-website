"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Menu, Search } from "lucide-react";
import { BRAND_LOGO_SRC } from "@/components/brand-logo";
import { NotificationDropdown } from "./notification-dropdown";
import { useMobileNav } from "./mobile-nav-context";

export function DashboardHeader() {
  const { user } = useUser();
  const { toggle } = useMobileNav();

  const firstName =
    user?.firstName?.trim() ||
    user?.fullName?.split(/\s+/)[0] ||
    user?.username ||
    "there";

  const avatarUrl =
    (typeof user?.publicMetadata?.avatarUrl === "string"
      ? user.publicMetadata.avatarUrl
      : null) || (user?.hasImage ? user.imageUrl : null);

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
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] sm:h-11 sm:w-11">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <Image
                  src={BRAND_LOGO_SRC}
                  alt="ORYNO"
                  width={44}
                  height={44}
                  className="h-[70%] w-[70%] object-contain"
                  priority
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Welcome back, {firstName} 👋
              </span>
            </span>
          </Link>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="relative hidden min-w-[180px] lg:block xl:min-w-[220px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search services…"
              className="h-10 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <NotificationDropdown />
        </div>
      </div>
    </motion.header>
  );
}
