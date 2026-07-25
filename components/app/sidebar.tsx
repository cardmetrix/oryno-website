"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { isNavActive, primaryNav, serviceNav } from "@/lib/app-nav";
import { AUTH_LINKS } from "@/lib/auth-links";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    router.push(AUTH_LINKS.signIn);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-border/80 bg-background/90 px-4 py-5 backdrop-blur-xl md:flex">
      <Link href="/dashboard" className="mb-8 flex items-center gap-2.5 px-2">
        <BrandLogo size={36} className="shadow-[var(--shadow-orange)]" />
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
            />
          ))}
        </NavGroup>
      </nav>

      <div className="mt-auto space-y-3 border-t border-border pt-4">
  

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-border bg-background px-3 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
          Log out
        </button>
      </div>
    </aside>
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
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="sidebar-active"
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
