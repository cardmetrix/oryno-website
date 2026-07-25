"use client";

import { Search } from "lucide-react";
import { activeCountryConfig } from "@/lib/services-catalog";
import { NotificationDropdown } from "./notification-dropdown";
import { PageHeader } from "./page-header";

type DashboardHeaderProps = {
  name?: string;
  subtitle?: string;
};

const countryFlags: Record<string, string> = {
  NG: "🇳🇬",
  GH: "🇬🇭",
  ZA: "🇿🇦",
  KE: "🇰🇪",
};

export function DashboardHeader({
  name = "Chidi",
  subtitle = "Welcome back to ORYNO",
}: DashboardHeaderProps) {
  const { code, name: countryName, currency, currencySymbol } =
    activeCountryConfig;
  const flag = countryFlags[code] ?? "🌍";

  return (
    <PageHeader
      title="Home"
      subtitle={`Hello, ${name} · ${subtitle}`}
      backHref="/"
      actions={
        <div className="flex items-center gap-2">
          <div
            className="inline-flex max-w-[46vw] items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1.5 shadow-[var(--shadow-soft)] sm:max-w-none sm:px-3"
            title={`${countryName} · ${currency}`}
          >
            <span className="text-sm leading-none">{flag}</span>
            <span className="truncate text-[11px] font-semibold text-foreground sm:text-xs">
              <span className="sm:hidden">
                {code} · {currencySymbol}
              </span>
              <span className="hidden sm:inline">
                {countryName} · {currency}
              </span>
            </span>
          </div>

          <div className="relative hidden min-w-[180px] lg:block xl:min-w-[240px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              placeholder="Search..."
              className="h-10 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <NotificationDropdown />
        </div>
      }
    />
  );
}
