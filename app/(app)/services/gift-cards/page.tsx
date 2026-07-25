"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function GiftCardsPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Gift Cards"
        subtitle="Buy & sell gift cards — launching soon"
        backHref="/services"
      />
      <MotionSection className="rounded-[22px] border border-border bg-background p-6 shadow-[var(--shadow-soft)]">
        <span className="badge-soon">Soon</span>
        <p className="mt-3 text-sm text-muted-foreground">
          Gift card marketplace is marked coming soon in Phase 1.
        </p>
      </MotionSection>
    </AppShell>
  );
}
