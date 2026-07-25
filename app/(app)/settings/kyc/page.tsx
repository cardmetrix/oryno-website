"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function KycPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="KYC Verification"
        subtitle="Step 2 of 4 · ID Document Upload"
        backHref="/settings"
      />
      <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 rounded-full bg-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          Upload a clear front and back of your ID to continue verification.
        </p>
        <button type="button" className="btn-primary mt-5 h-11 px-5 text-sm">
          Continue to Selfie
        </button>
      </MotionSection>
    </AppShell>
  );
}
