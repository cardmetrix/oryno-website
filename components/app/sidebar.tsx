"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, X } from "lucide-react";
import { BRAND_LOGO_SRC } from "@/components/brand-logo";
import { isNavActive, primaryNav, serviceNav } from "@/lib/app-nav";
import { announceLogout } from "@/lib/auth/client-logout";
import { AUTH_LINKS } from "@/lib/auth-links";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMobileNav } from "./mobile-nav-context";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { open, close } = useMobileNav();

  async function handleLogout() {
    close();
    await announceLogout();
    await signOut({ redirectUrl: AUTH_LINKS.signIn });
    router.push(AUTH_LINKS.signIn);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-border/80 bg-background/90 px-4 py-5 backdrop-blur-xl md:flex">
        <SidebarContent
          pathname={pathname}
          onLogout={handleLogout}
          onNavigate={() => undefined}
          activeLayoutId="sidebar-active-desktop"
        />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.button
              type="button"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-oryno-charcoal/40 backdrop-blur-[2px]"
              onClick={close}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              className="absolute inset-y-0 left-0 flex w-[min(86vw,300px)] flex-col border-r border-border/80 bg-background px-4 py-5 shadow-[0_20px_60px_rgba(28,28,30,0.28)]"
            >
              <button
                type="button"
                onClick={close}
                className="absolute top-4 right-3 flex h-9 w-9 items-center justify-center rounded-[12px] border border-border bg-background text-foreground"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
              <SidebarContent
                pathname={pathname}
                onLogout={handleLogout}
                onNavigate={close}
                activeLayoutId="sidebar-active-mobile"
              />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({
  pathname,
  onLogout,
  onNavigate,
  activeLayoutId,
}: {
  pathname: string;
  onLogout: () => void;
  onNavigate: () => void;
  activeLayoutId: string;
}) {
  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mb-8 flex items-center gap-2.5 px-2 pr-12 md:pr-2"
      >
        {/* Same crop as wallet card — keeps prior logo corner radius */}
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-[22%] bg-[#FF6A00] shadow-[var(--shadow-orange)]">
          <Image
            src={BRAND_LOGO_SRC}
            alt="ORYNO"
            fill
            sizes="36px"
            className="scale-[1.22] object-cover object-center"
          />
        </span>
        <div>
          <p className="text-base font-bold tracking-tight text-foreground">
            ORYNO
          </p>
          <p className="text-[11px] text-muted-foreground">Digital services</p>
        </div>
      </Link>

      <nav className="flex-1 space-y-6 overflow-y-auto pb-4">
        <NavGroup title="Main">
          {primaryNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isNavActive(pathname, item.href)}
              onNavigate={onNavigate}
              activeLayoutId={activeLayoutId}
            />
          ))}
        </NavGroup>

        <NavGroup title="Services">
          {serviceNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isNavActive(pathname, item.href)}
              onNavigate={onNavigate}
              activeLayoutId={activeLayoutId}
            />
          ))}
        </NavGroup>
      </nav>

      <div className="mt-auto space-y-3 border-t border-border pt-4">
    
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </>
  );
}

function NavGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onNavigate,
  activeLayoutId,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  onNavigate: () => void;
  activeLayoutId: string;
}) {
  return (
    <Link
      href={href}
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
      <span className="relative z-10">{label}</span>
    </Link>
  );
}
