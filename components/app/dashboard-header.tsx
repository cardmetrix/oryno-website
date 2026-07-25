"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { PageHeader } from "./page-header";

type DashboardHeaderProps = {
  name?: string;
  subtitle?: string;
};

export function DashboardHeader({
  name = "Chidi",
  subtitle = "Welcome back to ORYNO",
}: DashboardHeaderProps) {
  return (
    <>
      <PageHeader
        title="Home"
        subtitle={`Hello, ${name} · ${subtitle}`}
        backHref="/"
        actions={
          <div className="flex items-center gap-2">
            <div className="relative hidden min-w-[200px] lg:block xl:min-w-[260px]">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search..."
                className="h-10 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <Link
              href="/notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background transition hover:bg-muted"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5 text-foreground" strokeWidth={1.75} />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </Link>
          </div>
        }
      />
    </>
  );
}
