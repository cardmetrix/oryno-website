"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Lock,
  Shield,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  getAccountLevels,
  levelCta,
  resolveUserLevel,
  type AccountLevelId,
} from "@/lib/account-levels";
import type { ProfileDto } from "@/lib/profile";
import { cn } from "@/lib/utils";

export default function AccountLevelsPage() {
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = (await res.json()) as { profile: ProfileDto };
      setProfile(json.profile);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kycStatus = profile?.kycStatus || "unverified";
  const current = useMemo(() => resolveUserLevel(kycStatus), [kycStatus]);
  const levels = useMemo(
    () => getAccountLevels(profile?.countryCode),
    [profile?.countryCode],
  );
  const cta = useMemo(() => levelCta(kycStatus), [kycStatus]);
  const progress = ((current.id as AccountLevelId) / 3) * 100;

  return (
    <AppShell hideNav>
      <PageHeader
        title="Account Levels"
        subtitle="Increase your daily limit by verifying your identity"
        backHref="/profile"
      />

      <MotionSection className="relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#e85d00] p-5 text-white shadow-[0_16px_40px_rgba(255,106,0,0.28)] sm:p-6">
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl"
          animate={{ opacity: [0.35, 0.6, 0.35], scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative">
          <p className="text-[11px] font-bold tracking-[0.18em] text-white/75 uppercase">
            Your current level
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                {loading ? "Loading…" : current.name}
              </h2>
              <p className="mt-1 text-sm text-white/85">
                {loading
                  ? "Syncing account status"
                  : profile?.kycLabel || "Unverified"}
              </p>
            </div>
            <div className="rounded-2xl bg-black/15 px-3.5 py-2 text-right backdrop-blur-sm">
              <p className="text-[10px] font-semibold tracking-wide text-white/70 uppercase">
                Daily limit
              </p>
              <p className="text-lg font-bold tabular-nums">
                {loading
                  ? "—"
                  : profile?.dailyLimitLabel || levels[current.id - 1]?.dailyLimitLabel}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-white/80">
              <span>Progress</span>
              <span>
                Level {current.id} of 3
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${loading ? 0 : progress}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-white"
              />
            </div>
            <div className="mt-2.5 flex gap-1.5">
              {([1, 2, 3] as const).map((id) => (
                <span
                  key={id}
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    id <= current.id ? "bg-white" : "bg-white/25",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </MotionSection>

      {kycStatus === "rejected" ? (
        <MotionSection
          delay={0.04}
          className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3.5"
        >
          <p className="text-sm font-semibold text-destructive">
            Verification was rejected
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your daily limit is paused at ₦0 until you resubmit valid documents.
          </p>
        </MotionSection>
      ) : null}

      <MotionSection delay={0.06} className="mt-5 space-y-3">
        <div className="mb-1 flex items-center gap-2 px-0.5">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
          <p className="text-sm font-semibold text-foreground">
            Levels & features
          </p>
        </div>

        {levels.map((level, index) => {
          const isCurrent = level.id === current.id;
          const isUnlocked = level.id <= current.id;
          const isNext = level.id === current.id + 1;

          return (
            <motion.div
              key={level.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.05 }}
              className={cn(
                "relative overflow-hidden rounded-[22px] border px-4 py-4 sm:px-5 sm:py-5",
                isCurrent
                  ? "border-primary/40 bg-oryno-orange-muted/50 shadow-[var(--shadow-soft)]"
                  : "border-border bg-background",
                !isUnlocked && "opacity-75",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      isCurrent
                        ? "bg-primary text-primary-foreground"
                        : isUnlocked
                          ? "bg-oryno-orange-muted text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isUnlocked ? (
                      level.id === 3 ? (
                        <BadgeCheck className="h-5 w-5" strokeWidth={1.75} />
                      ) : (
                        <Check className="h-5 w-5" strokeWidth={2} />
                      )
                    ) : (
                      <Lock className="h-4 w-4" strokeWidth={1.75} />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        {level.name}
                      </h3>
                      {isCurrent ? (
                        <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                          Current
                        </span>
                      ) : null}
                      {isNext ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                          Next
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {level.description}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-foreground">
                      Daily limit · {level.dailyLimitLabel}
                    </p>
                  </div>
                </div>
              </div>

              <ul className="mt-4 space-y-2 border-t border-border/80 pt-3.5">
                {level.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-foreground"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                        isUnlocked
                          ? "bg-oryno-orange-muted text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    </span>
                    <span className={cn(!isUnlocked && "text-muted-foreground")}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </MotionSection>

      <MotionSection delay={0.12} className="mt-5 space-y-3 pb-6">
        <div className="rounded-[22px] border border-border bg-background px-4 py-4 shadow-[var(--shadow-soft)]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
              <Shield className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Raise your limit with KYC
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Upload a government ID and selfie. Once approved, you move to
                Level 3 with the highest daily limit.
              </p>
            </div>
          </div>
        </div>

        {cta.disabled ? (
          <button
            type="button"
            disabled
            className="btn-secondary inline-flex h-12 w-full items-center justify-center gap-2 text-sm opacity-70"
          >
            <BadgeCheck className="h-4 w-4" />
            {cta.label}
          </button>
        ) : (
          <Link
            href={cta.href}
            className="btn-primary inline-flex h-12 w-full items-center justify-center gap-2 text-sm"
          >
            {cta.label}
            <ArrowUpRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}

        <Link
          href="/profile"
          className="group flex items-center justify-between rounded-[18px] border border-border bg-background px-4 py-3.5 shadow-[var(--shadow-soft)] transition hover:border-primary/30 hover:bg-muted/40"
        >
          <span className="text-sm font-semibold text-foreground">
            Back to profile
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </Link>
      </MotionSection>
    </AppShell>
  );
}
