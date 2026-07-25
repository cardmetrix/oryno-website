"use client";

import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Switch } from "@/components/ui/switch";

export default function SecurityPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Security Settings"
        subtitle="2FA, biometrics, and active sessions"
        backHref="/settings"
      />
      <MotionSection className="space-y-3 rounded-[22px] border border-border bg-background p-4 shadow-[var(--shadow-soft)]">
        {[
          "Two-Factor Auth (2FA)",
          "Biometric Sign In",
          "Transaction PIN",
        ].map((label, i) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-[14px] bg-muted/40 px-4 py-3.5"
          >
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {i < 2 ? <Switch defaultChecked /> : <span className="text-xs font-semibold text-primary">Manage</span>}
          </div>
        ))}
      </MotionSection>
    </AppShell>
  );
}
