"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

export default function WithdrawPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Withdraw"
        subtitle="Send funds to your local bank — routed automatically"
        backHref="/wallet"
      />

      <MotionSection className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Amount (₦)</span>
          <input
            defaultValue="10000"
            className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-foreground">
            Bank Account
          </span>
          <input
            defaultValue="Kuda •••• 0394"
            className="mt-2 h-12 w-full rounded-[14px] border border-border bg-muted/40 px-4 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
      </MotionSection>

      <MotionSection delay={0.08}>
        <button
          type="button"
          className="btn-primary mt-6 h-12 w-full text-base md:max-w-sm"
        >
          Withdraw Funds
        </button>
      </MotionSection>
    </AppShell>
  );
}
