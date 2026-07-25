"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function VirtualNumbersPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Virtual Numbers"
        subtitle="Get permanent or temporary overseas lines"
        backHref="/services"
      />
      <MotionSection className="rounded-[22px] border border-border bg-background p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">
          Country selection and number rental UI will connect to your provider
          catalog.
        </p>
        <button type="button" className="btn-primary mt-5 h-11 px-5 text-sm">
          Purchase Number
        </button>
      </MotionSection>
    </AppShell>
  );
}
