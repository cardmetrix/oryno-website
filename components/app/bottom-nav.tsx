"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { isNavActive, primaryNav } from "@/lib/app-nav";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex h-[68px] max-w-lg items-center justify-between rounded-[22px] border border-border/70 bg-background/85 px-2 shadow-[0_12px_40px_rgba(28,28,30,0.14)] backdrop-blur-2xl">
        {primaryNav.map((tab) => {
          const Icon = tab.icon;
          const active = isNavActive(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-[16px] text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="bottom-active"
                  className="absolute inset-1 rounded-[14px] bg-oryno-orange-muted"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              ) : null}
              <Icon
                className="relative z-10 h-5 w-5"
                strokeWidth={active ? 2.3 : 1.75}
              />
              <span className="relative z-10">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
