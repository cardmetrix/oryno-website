"use client";

import { motion } from "framer-motion";
import { MobileNavProvider } from "./mobile-nav-context";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  className?: string;
  /** @deprecated Bottom nav removed; kept for call-site compatibility */
  hideNav?: boolean;
};

export function AppShell({ children, className }: AppShellProps) {
  return (
    <MobileNavProvider>
      <div className="min-h-[100svh] bg-[image:var(--app-shell-gradient)] text-foreground">
        <Sidebar />

        <div className="md:pl-[260px]">
          <motion.main
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "mx-auto min-h-[100svh] w-full max-w-6xl px-4 pt-0 pb-8 sm:px-6 md:pb-10 lg:px-8",
              className,
            )}
          >
            {children}
          </motion.main>
        </div>
      </div>
    </MobileNavProvider>
  );
}
