"use client";

import Link from "next/link";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";

const fields = [
  { label: "Full Name", value: "Chidi Okechukwu" },
  { label: "Email Address", value: "chidi.okechukwu@oryno.co" },
  { label: "Phone Number", value: "+234 803 111 5678" },
  { label: "Country", value: "Nigeria" },
];

export default function ProfilePage() {
  return (
    <AppShell>
      <PageHeader
        title="Profile"
        subtitle="Manage your ORYNO identity"
        backHref="/dashboard"
      />

      <MotionSection className="rounded-[22px] border border-border bg-background p-6 text-center shadow-[var(--shadow-soft)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-oryno-orange-muted text-xl font-bold text-primary ring-4 ring-primary/10">
          CO
        </div>
        <p className="mt-3 text-lg font-bold text-foreground">
          Chidi Okechukwu
        </p>
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-oryno-success/12 px-2.5 py-1 text-xs font-semibold text-oryno-success">
          <BadgeCheck className="h-3.5 w-3.5" />
          Verified Tier 3
        </span>
      </MotionSection>

      <MotionSection
        delay={0.08}
        className="mt-5 overflow-hidden rounded-[22px] border border-border bg-background shadow-[var(--shadow-soft)]"
      >
        {fields.map((field, index) => (
          <div
            key={field.label}
            className={
              index === 0 ? "px-4 py-3.5" : "border-t border-border px-4 py-3.5"
            }
          >
            <p className="text-xs text-muted-foreground">{field.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">
              {field.value}
            </p>
          </div>
        ))}
        <div className="border-t border-border bg-oryno-orange-muted/60 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-primary">
                Account Limit Status
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                ₦5,000,000.00 daily limit
              </p>
            </div>
            <Link href="/settings" className="text-xs font-semibold text-primary">
              View Levels
            </Link>
          </div>
        </div>
      </MotionSection>

      <MotionSection delay={0.12} className="mt-5 space-y-3">
        <Link
          href="/settings"
          className="btn-primary inline-flex h-12 w-full items-center justify-center text-base"
        >
          Edit Profile
        </Link>
        <Link
          href="/settings"
          className="flex items-center justify-between rounded-[16px] border border-border bg-background px-4 py-3.5 shadow-[var(--shadow-soft)]"
        >
          <span className="text-sm font-semibold text-foreground">Settings</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </MotionSection>
    </AppShell>
  );
}
