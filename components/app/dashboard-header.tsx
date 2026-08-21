"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Menu, Search } from "lucide-react";
import { NotificationDropdown } from "./notification-dropdown";
import { useMobileNav } from "./mobile-nav-context";

function initialsFrom(name?: string | null) {
  if (!name) return "OR";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "OR"
  );
}

export function DashboardHeader() {
  const { user } = useUser();
  const { toggle } = useMobileNav();

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.fullName ||
    user?.username ||
    "ORYNO User";
  const firstName =
    user?.firstName?.trim() || fullName.split(/\s+/)[0] || "there";
  const avatarUrl =
    (typeof user?.publicMetadata?.avatarUrl === "string"
      ? user.publicMetadata.avatarUrl
      : null) || user?.imageUrl || null;

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
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={fullName}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-bold text-primary sm:text-sm">
                  {initialsFrom(fullName)}
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
