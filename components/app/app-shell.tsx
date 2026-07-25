"use client";

import { motion } from "framer-motion";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
  /** Hide mobile bottom nav (sidebar still shows on md+) */
  hideNav?: boolean;
};

export function AppShell({
  children,
  className,
  hideNav = false,
}: AppShellProps) {
  return (
    <div className="min-h-[100svh] bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f9_100%)] text-foreground">
      <Sidebar />

      <div className="md:pl-[260px]">
        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "mx-auto min-h-[100svh] w-full max-w-6xl px-4 pt-0 sm:px-6 lg:px-8",
            hideNav ? "pb-8" : "pb-28 md:pb-10",
            className,
          )}
        >
          {children}
        </motion.main>
      </div>

      {hideNav ? null : <BottomNav />}
    </div>
  );
}
