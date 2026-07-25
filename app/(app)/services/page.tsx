"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { serviceNav } from "@/lib/app-nav";

const descriptions: Record<string, string> = {
  "/services/airtime": "Top up any network instantly",
  "/services/data": "Daily, weekly & monthly bundles",
  "/services/bills": "Electricity, DStv, GOtv, Startimes",
  "/services/social": "Followers, likes, views & more",
  "/services/gift-cards": "Buy & sell — coming soon",
  "/services/virtual-numbers": "Buy permanently or rent for SMS",
};

const soonHrefs = new Set(["/services/gift-cards"]);

export default function ServicesPage() {
  return (
    <AppShell>
      <PageHeader
        title="All Services"
        subtitle="One app. Endless possibilities."
        backHref="/dashboard"
      />

      <MotionSection className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {serviceNav
          .filter((item) => item.href !== "/services")
          .map((item, index) => {
            const Icon = item.icon;
            const soon = soonHrefs.has(item.href);
            return (
              <motion.div
                key={item.href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                whileHover={{ y: -4 }}
              >
                <Link
                  href={item.href}
                  className="relative flex items-center gap-3 rounded-[18px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30 hover:bg-oryno-orange-muted/40"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-oryno-orange-muted text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 pr-10">
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {descriptions[item.href] ?? "Open service"}
                    </p>
                  </div>
                  {soon ? (
                    <span className="badge-soon absolute top-3 right-3">
                      Soon
                    </span>
                  ) : null}
                </Link>
              </motion.div>
            );
          })}
      </MotionSection>
    </AppShell>
  );
}
