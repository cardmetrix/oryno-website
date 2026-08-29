"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  Bell,
  ChevronRight,
  Gauge,
  HelpCircle,
  History,
  Languages,
  LockKeyhole,
  LogOut,
  MessageCircle,
  Moon,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { SettingsSkeleton } from "@/components/app/settings-skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { useCountry } from "@/components/providers/country-provider";
import { announceLogout } from "@/lib/auth/client-logout";
import { AUTH_LINKS } from "@/lib/auth-links";
import {
  languageLabel as resolveLanguageLabel,
  languagesForCountry,
} from "@/lib/country";
import type { ProfileDto } from "@/lib/profile";
import { cn } from "@/lib/utils";

type SettingsPayload = {
  profile: ProfileDto;
  preferences: {
    theme: "light" | "dark" | "system";
    language: string;
    notificationsEnabled: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    biometricEnabled: boolean;
    hasPin: boolean;
  };
};

export default function SettingsPage() {
  const { isLoaded } = useUser();
  const { signOut } = useClerk();
  const { country } = useCountry();
  const [data, setData] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const languages = languagesForCountry(
    data?.profile.countryCode ?? country.code,
  );

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as SettingsPayload;
      setData(json);
      // Do not call setTheme here — the toggle already owns the live theme.
      // Overwriting on load caused a visible light/dark glitch.
    } catch {
      toast.error("Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    void load();
  }, [isLoaded, load]);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || "Update failed");
    }
    setData((prev) =>
      prev
        ? {
            ...prev,
            preferences: json.preferences ?? prev.preferences,
            security: json.security ?? prev.security,
            profile: json.profile ?? prev.profile,
          }
        : prev,
    );
    return json;
  }

  async function onNotifications(checked: boolean) {
    try {
      await patch({ notificationsEnabled: checked });
      toast.success(checked ? "Notifications on" : "Notifications off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onLanguage(language: string) {
    try {
      await patch({ language });
      toast.success("Language updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function onThemePersist(nextDark: boolean) {
    // ThemeToggle already painted the theme instantly.
    setSaving(true);
    try {
      await patch({ theme: nextDark ? "dark" : "light" });
    } catch {
      // Theme still applied locally
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded || loading || !data) {
    return (
      <AppShell>
        <PageHeader
          title="Settings"
          subtitle="Preferences, security, and support"
          backHref="/profile"
        />
        <SettingsSkeleton />
      </AppShell>
    );
  }

  const countryCode = data.profile.countryCode ?? country.code;
  const languageLabel = resolveLanguageLabel(
    data.preferences.language,
    countryCode,
  );

  return (
    <AppShell>
      <PageHeader
        title="Settings"
        subtitle="Preferences, security, and support"
        backHref="/profile"
      />

      <MotionSection className="mb-5 overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] p-5 text-white shadow-[0_16px_40px_rgba(255,106,0,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/75 uppercase">
              Account
            </p>
            <p className="mt-1 text-lg font-bold tracking-tight">
              {data.profile.fullName}
            </p>
            <p className="mt-0.5 text-sm text-white/80">{data.profile.email}</p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold",
              data.profile.kycStatus === "verified"
                ? "bg-white/20 text-white"
                : "bg-black/20 text-[#ffd29a]",
            )}
          >
            {data.profile.kycLabel}
          </span>
        </div>
        <p className="mt-3 text-xs text-white/75">
          Daily limit · {data.profile.dailyLimitLabel}
        </p>
      </MotionSection>

      <MotionSection delay={0.04}>
        <Section title="Account">
          <Row href="/profile" icon={UserRound} label="Profile Details" hint={data.profile.username ? `@${data.profile.username}` : undefined} />
          <Row
            href="/settings/security"
            icon={LockKeyhole}
            label="Security & PIN"
            hint={data.security.hasPin ? "PIN set" : "Set PIN"}
          />
          <Row
            href="/settings/levels"
            icon={Gauge}
            label="Account Levels"
            hint={`${data.profile.dailyLimitLabel} daily`}
          />
          <Row
            href="/settings/kyc"
            icon={ShieldCheck}
            label="KYC Verification"
            hint={data.profile.kycLabel}
          />
          <Row href="/wallet" icon={Wallet} label="Wallet & Banks" />
          <Row href="/history" icon={History} label="Transaction History" />
        </Section>
      </MotionSection>

      <MotionSection delay={0.08}>
        <Section title="Preferences">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-3">
              <IconBubble icon={Bell} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Push Notifications
                </p>
                <p className="text-xs text-muted-foreground">
                  Alerts for payments & promos
                </p>
              </div>
            </div>
            <Switch
              checked={Boolean(data.preferences.notificationsEnabled)}
              onCheckedChange={(v) => void onNotifications(v)}
            />
          </div>

          <div className="border-t border-border px-4 py-3.5">
            <div className="mb-2.5 flex items-center gap-3">
              <IconBubble icon={Languages} />
              <div>
                <p className="text-sm font-semibold text-foreground">Language</p>
                <p className="text-xs text-muted-foreground">
                  {languageLabel} · {country.name}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pl-12">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => void onLanguage(lang.code)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    data.preferences.language === lang.code
                      ? "bg-oryno-charcoal text-white"
                      : "bg-muted text-muted-foreground hover:bg-oryno-orange-muted hover:text-primary",
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border px-4 py-3.5">
            <div className="flex items-center gap-3">
              <IconBubble icon={Moon} />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Dark Mode
                </p>
                <p className="text-xs text-muted-foreground">
                  Saved to your account
                </p>
              </div>
            </div>
            <ThemeToggle
              disabled={saving || loading}
              onCheckedChangePersist={(checked) => onThemePersist(checked)}
            />
          </div>
        </Section>
      </MotionSection>

      <MotionSection delay={0.12}>
        <Section title="Support">
          <Row href="/support" icon={HelpCircle} label="Help Center" />
          <Row href="/support" icon={MessageCircle} label="Live Chat" />
          <Row href="/about" icon={ShieldCheck} label="About ORYNO" />
        </Section>
      </MotionSection>

      <MotionSection delay={0.16} className="mt-2 mb-8">
        <motion.button
          type="button"
          whileTap={{ scale: 0.985 }}
          onClick={() =>
            void (async () => {
              await announceLogout();
              await signOut({ redirectUrl: AUTH_LINKS.signIn });
            })()
          }
          className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-destructive/25 bg-destructive/8 text-sm font-bold text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </motion.button>
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
      <div className="overflow-hidden rounded-[22px] border border-border bg-background shadow-[var(--shadow-soft)]">
        {children}
      </div>
    </section>
  );
}

function Row({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between border-t border-border px-4 py-3.5 transition first:border-t-0 hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="flex min-w-0 items-center gap-3">
        <IconBubble icon={Icon} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {hint ? (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function IconBubble({
  icon: Icon,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}
