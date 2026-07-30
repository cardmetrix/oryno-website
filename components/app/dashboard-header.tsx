"use client";

import { useUser } from "@clerk/nextjs";
import { Search } from "lucide-react";
import { useCountry } from "@/components/providers/country-provider";
import { NotificationDropdown } from "./notification-dropdown";
import { PageHeader } from "./page-header";


type DashboardHeaderProps = {
  subtitle?: string;
};

export function DashboardHeader({
  subtitle = "Welcome back to ORYNO",
}: DashboardHeaderProps) {
  const { user } = useUser();
  const { country } = useCountry();
  const displayName = user?.username || "there";

  return (
    <PageHeader
      title="Home"
      subtitle={`Hello, ${displayName} 👋`}
      backHref="/"
      actions={
        <>
          <div
            className="inline-flex max-w-[7.5rem] items-center gap-1.5 rounded-[14px] border border-border bg-background px-2 py-1.5 shadow-[var(--shadow-soft)] sm:max-w-none sm:gap-2 sm:px-3"
            title={`${country.name} · ${country.currency}`}
          >
            <span className="text-base leading-none">{country.flagEmoji}</span>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-[11px] font-bold text-foreground sm:text-xs">
                {country.currency}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                <span className="sm:hidden">
                  {country.code} · {country.currencySymbol}
                </span>
                <span className="hidden sm:inline">{country.name}</span>
              </p>
            </div>
          </div>

          <div className="relative hidden min-w-[180px] lg:block xl:min-w-[220px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search services…"
              className="h-10 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <NotificationDropdown />
        </>
      }
    />
  );
}
