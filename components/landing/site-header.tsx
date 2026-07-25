"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { AuthButtons } from "./auth-buttons";
import { StoreButtons } from "./store-buttons";

const links = [
  { href: "#features", label: "Features" },
  { href: "#wallet", label: "Wallet" },
  { href: "#screenshots", label: "App" },
  { href: "#download", label: "Download" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/80 bg-background/90 backdrop-blur-xl"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-6 lg:px-8">
        <a href="#top" className="flex shrink-0 items-center gap-2.5">
          <BrandLogo
            size={36}
            priority
            className="shadow-[var(--shadow-orange)]"
          />
          <span className="text-lg font-bold tracking-tight text-foreground">
            ORYNO
          </span>
        </a>

        <nav className="hidden items-center gap-6 xl:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2.5 md:flex">
      
          <StoreButtons size="compact" />
          <AuthButtons />
        </div>

        <div className="flex items-center gap-1.5 md:hidden">
  
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] text-foreground"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-border bg-background md:hidden"
          >
            <nav className="flex flex-col gap-3 px-5 py-4">
              {links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-[var(--radius-sm)] px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {link.label}
                </a>
              ))}
              <AuthButtons
                layout="stack"
                className="mt-1 w-full"
                onNavigate={() => setOpen(false)}
              />
              <StoreButtons
                size="compact"
                layout="column"
                className="mt-1 w-full [&_a]:w-full"
              />
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.header>
  );
}
