"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function SupportPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Help & Support"
        subtitle="Live chat, tickets, and FAQs"
        backHref="/settings"
      />
      <MotionSection className="space-y-3">
        <button type="button" className="btn-primary h-12 w-full text-base">
          Start Live Chat
        </button>
        <button type="button" className="btn-secondary h-12 w-full text-base">
          Create Support Ticket
        </button>
      </MotionSection>
    </AppShell>
  );
}
