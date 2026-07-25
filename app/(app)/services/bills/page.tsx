"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function BillsPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Bill Payments"
        subtitle="Settle utility & television services instantly"
        backHref="/services"
      />
      <MotionSection className="rounded-[22px] border border-border bg-background p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">
          Electricity, DStv, GOtv, and Startimes will plug into country
          configuration next.
        </p>
        <button type="button" className="btn-primary mt-5 h-11 px-5 text-sm">
          Pay Bill
        </button>
      </MotionSection>
    </AppShell>
  );
}
