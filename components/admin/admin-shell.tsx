"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { adminNav, isAdminNavActive } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

async function logoutAdmin(router: ReturnType<typeof useRouter>) {
  try {
    await fetch("/api/admin/auth/logout", { method: "POST" });
  } catch {
    // ignore
  }
  router.replace("/admin/login");
}

export function AdminShell({
  children,
  admin,
}: {
  children: React.ReactNode;
  admin?: { name: string; email: string; role: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="min-h-[100svh] bg-[image:var(--app-shell-gradient)] text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-border/80 bg-background/90 px-4 py-5 backdrop-blur-xl lg:flex">
        <AdminBrand />
        <AdminNav pathname={pathname} activeLayoutId="admin-nav-desktop" />
        <AdminFooter
          admin={admin}
          onLogout={() => void logoutAdmin(router)}
        />
      </aside>

      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-oryno-charcoal/40 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-[min(88vw,300px)] flex-col border-r border-border bg-background px-4 py-5 shadow-[0_20px_60px_rgba(28,28,30,0.28)]"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute top-4 right-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-border"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
              <AdminBrand />
              <AdminNav
                pathname={pathname}
                onNavigate={() => setOpen(false)}
                activeLayoutId="admin-nav-mobile"
              />
              <AdminFooter
                admin={admin}
                onLogout={() => void logoutAdmin(router)}
              />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="lg:pl-[272px]">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-[image:var(--header-surface)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] lg:hidden"
                aria-label="Open admin menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  ORYNO Admin
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {admin
                    ? `${admin.name} · ${admin.role.replace(/_/g, " ")}`
                    : "Country-configurable control center"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-semibold text-foreground shadow-[var(--shadow-soft)] sm:inline-flex">
                <span className="h-2 w-2 rounded-full bg-[var(--oryno-success)]" />
                Live
              </span>
              <ThemeToggle variant="icon" />
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => void logoutAdmin(router)}
                className="inline-flex h-10 items-center gap-1.5 rounded-[14px] border border-border bg-background px-3 text-sm font-semibold text-foreground shadow-[var(--shadow-soft)]"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden sm:inline">Log out</span>
              </motion.button>
            </div>
          </div>
        </header>

        <motion.main
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

function AdminBrand() {
  return (
    <Link
      href="/admin"
      className="mb-7 flex items-center gap-2.5 px-2 pr-10 lg:pr-2"
    >
      <BrandLogo size={36} className="shadow-[var(--shadow-orange)]" />
      <div>
        <p className="text-base font-bold tracking-tight text-foreground">
          ORYNO
        </p>
        <p className="text-[11px] text-muted-foreground">Admin console</p>
      </div>
    </Link>
  );
}

function AdminNav({
  pathname,
  onNavigate,
  activeLayoutId,
}: {
  pathname: string;
  onNavigate?: () => void;
  activeLayoutId: string;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto pb-4">
      {adminNav.map((item) => {
        const Icon = item.icon;
        const active = isAdminNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={activeLayoutId}
                className="absolute inset-0 rounded-[14px] bg-oryno-orange-muted"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <Icon
              className="relative z-10 h-[18px] w-[18px]"
              strokeWidth={active ? 2.2 : 1.75}
            />
            <span className="relative z-10">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function AdminFooter({
  onLogout,
  admin,
}: {
  onLogout: () => void;
  admin?: { name: string; email: string; role: string };
}) {
  return (
    <div className="mt-auto space-y-3 border-t border-border pt-4">
      <div className="rounded-[16px] bg-gradient-to-br from-oryno-orange to-oryno-orange-soft p-4 text-white shadow-[var(--shadow-orange)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">Live console</p>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/18 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-white/25">
            <span className="h-1.5 w-1.5 rounded-full bg-white" />
            Online
          </span>
        </div>
        <p className="mt-1 text-xs text-white/85">
          {admin
            ? `${admin.email}`
            : "Manage users, wallets, providers, countries & gateways."}
        </p>
        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLogout}
          className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-[12px] bg-oryno-charcoal text-sm font-semibold text-white"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </motion.button>
      </div>
    </div>
  );
}
