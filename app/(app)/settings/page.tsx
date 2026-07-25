"use client";

import Link from "next/link";
import {
  Bell,
  ChevronRight,
  HelpCircle,
  Languages,
  LockKeyhole,
  MessageCircle,
  Moon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { Switch } from "@/components/ui/switch";

export default function SettingsPage() {
  return (
    <AppShell hideNav>
      <PageHeader
        title="Settings"
        subtitle="Preferences, security, and support"
        backHref="/profile"
      />

      <MotionSection>
        <Section title="Account Settings">
          <Row href="/profile" icon={UserRound} label="Profile Details" />
          <Row
            href="/settings/security"
            icon={LockKeyhole}
            label="Security & PIN"
          />
          <Row
            href="/settings/kyc"
            icon={ShieldCheck}
            label="KYC Verification"
          />
        </Section>
      </MotionSection>

      <MotionSection delay={0.06}>
        <Section title="Preferences">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <IconBubble icon={Bell} />
              <span className="text-sm font-semibold text-foreground">
                Notifications
              </span>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3.5">
            <div className="flex items-center gap-3">
              <IconBubble icon={Languages} />
              <span className="text-sm font-semibold text-foreground">
                Language
              </span>
            </div>
            <span className="text-sm text-muted-foreground">English</span>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3.5">
            <div className="flex items-center gap-3">
              <IconBubble icon={Moon} />
              <span className="text-sm font-semibold text-foreground">
                Dark Mode
              </span>
            </div>
            <Switch />
          </div>
        </Section>
      </MotionSection>

      <MotionSection delay={0.1}>
        <Section title="Support">
          <Row href="/support" icon={HelpCircle} label="Help Center" />
          <Row href="/support" icon={MessageCircle} label="Live Chat" />
          <Row href="/" icon={ShieldCheck} label="About ORYNO" />
        </Section>
      </MotionSection>
    </AppShell>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-5">
      <p className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <div className="overflow-hidden rounded-[18px] border border-border bg-background shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </section>
  );
}

function Row({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-t border-border px-4 py-3.5 first:border-t-0"
    >
      <div className="flex items-center gap-3">
        <IconBubble icon={Icon} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

function IconBubble({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}
