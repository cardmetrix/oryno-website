"use client";

import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function DataPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Data Bundles"
        subtitle="Choose super-fast internet subscription packs"
        backHref="/services"
      />
      <MotionSection className="rounded-[22px] border border-border bg-background p-6 shadow-[var(--shadow-soft)]">
        <p className="text-sm text-muted-foreground">
          Data plans UI is ready for provider configs. Start from airtime for a
          full interactive example.
        </p>
        <Link
          href="/services/airtime"
          className="btn-primary mt-5 inline-flex h-11 items-center justify-center px-5 text-sm"
        >
          Open Airtime flow
        </Link>
      </MotionSection>
    </AppShell>
  );
}
