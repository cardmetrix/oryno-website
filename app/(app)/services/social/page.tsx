"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Link2,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  activeCountryConfig,
  formatMoney,
  socialPlatforms,
} from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

export default function SocialBoostPage() {
  const { socialPackages } = activeCountryConfig;
  const [platform, setPlatform] =
    useState<(typeof socialPlatforms)[number]>("All");
  const [packageId, setPackageId] = useState(socialPackages[0]?.id ?? "");
  const [profileUrl, setProfileUrl] = useState("https://instagram.com/oryno");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const walletBalance = 1245600;

  const packages = useMemo(
    () =>
      platform === "All"
        ? socialPackages
        : socialPackages.filter((p) => p.platform === platform),
    [platform, socialPackages],
  );

  const selected =
    packages.find((p) => p.id === packageId) ?? packages[0] ?? null;

  const canSubmit =
    Boolean(selected) &&
    profileUrl.trim().length > 8 &&
    /^(https?:\/\/|@)/i.test(profileUrl.trim());

  function onPlatformChange(next: (typeof socialPlatforms)[number]) {
    setPlatform(next);
    const list =
      next === "All"
        ? socialPackages
        : socialPackages.filter((p) => p.platform === next);
    if (list[0]) setPackageId(list[0].id);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 900);
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Social Boosting"
        subtitle="Grow followers, likes, views — securely"
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success && selected ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-[28px] border border-border bg-background p-8 text-center shadow-[var(--shadow-soft)]"
            >
              <motion.span
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-oryno-orange-muted text-primary"
              >
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} />
              </motion.span>
              <h2 className="mt-5 text-2xl font-bold text-foreground">
                Boost ordered
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.quantity} {selected.metric.toLowerCase()} for{" "}
                {selected.platform} is processing. Delivery: {selected.delivery}.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSuccess(false)}
                  className="btn-primary h-12 px-6"
                >
                  Boost again
                </motion.button>
                <motion.a
                  href="/dashboard"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-secondary inline-flex h-12 items-center justify-center px-6"
                >
                  Back to Home
                </motion.a>
              </div>
            </motion.div>
          </MotionSection>
        ) : (
          <form key="form" onSubmit={onSubmit} className="space-y-5">
            <MotionSection className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <TrendingUp className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Choose platform
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Packages update from your country catalog
                  </p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {socialPlatforms.map((item) => {
                  const active = platform === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onPlatformChange(item)}
                      className={cn(
                        "relative shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                          : "bg-muted text-foreground hover:bg-oryno-orange-muted",
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.06}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Profile or post link
                </span>
                <div className="mt-2 flex h-14 items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <Link2
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <input
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                    placeholder="https://… or @username"
                    required
                    className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Boost packages
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Pick a package that fits your goal
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>

              <div className="grid gap-3">
                <AnimatePresence mode="popLayout">
                  {packages.map((item, index) => {
                    const active = selected?.id === item.id;
                    return (
                      <motion.button
                        key={item.id}
                        type="button"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ delay: index * 0.03, duration: 0.28 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setPackageId(item.id)}
                        className={cn(
                          "rounded-[20px] border px-4 py-4 text-left transition-colors",
                          active
                            ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
                            : "border-border bg-background hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-primary">
                                {item.platform}
                              </p>
                              {item.popular ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                                  Popular
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-lg font-bold tracking-tight text-foreground">
                              {item.quantity} {item.metric}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.name} · Delivery {item.delivery}
                            </p>
                          </div>
                          <p className="text-base font-bold text-foreground">
                            {formatMoney(item.price)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            </MotionSection>

            <MotionSection
              delay={0.14}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <h2 className="text-base font-semibold text-foreground">
                Order summary
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow
                  label="Platform"
                  value={selected?.platform ?? "—"}
                />
                <SummaryRow
                  label="Package"
                  value={
                    selected
                      ? `${selected.quantity} ${selected.metric}`
                      : "—"
                  }
                />
                <SummaryRow label="Target" value={profileUrl || "—"} />
                <SummaryRow
                  label="Amount"
                  value={selected ? formatMoney(selected.price) : formatMoney(0)}
                  accent
                />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    Wallet balance
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatMoney(walletBalance)}
                  </span>
                </div>
              </div>
            </MotionSection>

            <MotionSection delay={0.18}>
              <motion.button
                type="submit"
                disabled={!canSubmit || submitting}
                whileHover={canSubmit ? { y: -2 } : undefined}
                whileTap={canSubmit ? { scale: 0.985 } : undefined}
                className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
              >
                {submitting
                  ? "Processing…"
                  : selected
                    ? `Boost now · ${formatMoney(selected.price)}`
                    : "Boost now"}
              </motion.button>
            </MotionSection>
          </form>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[60%] truncate text-right font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
