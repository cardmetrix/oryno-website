"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { serviceNav } from "@/lib/app-nav";

export default function ServicesPage() {
  return (
    <AppShell>
      <PageHeader
        title="All Services"
        subtitle="Everything you need in one place"
        backHref="/dashboard"
      />

      <MotionSection className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {serviceNav
          .filter((item) => item.href !== "/services")
          .map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.href}
                whileHover={{ y: -4 }}
                transition={{ delay: index * 0.02 }}
              >
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-[18px] border border-border bg-background p-4 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/30 hover:bg-oryno-orange-muted/40"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-oryno-orange-muted text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground">Open service</p>
                  </div>
                </Link>
              </motion.div>
            );
          })}
      </MotionSection>
    </AppShell>
  );
}
