"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  Inbox,
  Mail,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  activeCountryConfig,
  formatMoney,
  type EmailRentOffer,
} from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

const EMAIL_INSTRUCTIONS = [
  "Pick a rental duration and mailbox type.",
  "Pay with your ORYNO wallet — powered by HeroSMS.",
  "Copy the temporary email when it’s issued.",
  "Use it on the site that needs verification.",
  "Open your inbox here to grab the OTP or link.",
];

const durations = ["All", "10 minutes", "1 hour", "24 hours"] as const;

export default function EmailRentPage() {
  const { emailRentals } = activeCountryConfig;
  const [duration, setDuration] =
    useState<(typeof durations)[number]>("All");
  const [offerId, setOfferId] = useState(emailRentals[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const walletBalance = 1245600;

  const offers = useMemo(() => {
    return emailRentals.filter(
      (offer) => duration === "All" || offer.duration === duration,
    );
  }, [emailRentals, duration]);

  const selected: EmailRentOffer | null =
    offers.find((o) => o.id === offerId) ?? offers[0] ?? null;

  const canSubmit = Boolean(selected);

  function onDurationChange(next: (typeof durations)[number]) {
    setDuration(next);
    const nextOffers = emailRentals.filter(
      (offer) => next === "All" || offer.duration === next,
    );
    if (nextOffers[0]) setOfferId(nextOffers[0].id);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting || !selected) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 900);
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Rent Email"
        subtitle="Temporary inboxes for OTP & sign-ups · HeroSMS"
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
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]"
              >
                <CheckCircle2 className="h-8 w-8" strokeWidth={1.75} />
              </motion.span>
              <h2 className="mt-5 text-2xl font-bold text-foreground">
                Email reserved
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.provider} · {selected.duration}. Your temporary
                inbox is ready — copy the address and watch for codes.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSuccess(false)}
                  className="btn-primary h-12 px-6"
                >
                  Rent another email
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
                  <Mail className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Rent a mailbox
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Temporary emails for verification — powered by HeroSMS
                  </p>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {durations.map((item) => (
                  <FilterChip
                    key={item}
                    active={duration === item}
                    onClick={() => onDurationChange(item)}
                    label={item === "All" ? "All durations" : item}
                    icon={item !== "All" ? Clock3 : undefined}
                  />
                ))}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.06}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <h2 className="mb-4 text-base font-semibold text-foreground">
                Available rentals
              </h2>
              <div className="grid gap-3">
                <AnimatePresence mode="popLayout">
                  {offers.map((offer, index) => {
                    const active = selected?.id === offer.id;
                    return (
                      <motion.button
                        key={offer.id}
                        type="button"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ delay: index * 0.03, duration: 0.28 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setOfferId(offer.id)}
                        className={cn(
                          "rounded-[20px] border px-4 py-4 text-left transition-colors",
                          active
                            ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
                            : "border-border bg-background hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary">
                              <Inbox className="h-5 w-5" strokeWidth={1.75} />
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {offer.provider}
                                </p>
                                {offer.popular ? (
                                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                                    Popular
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {offer.category} · {offer.duration}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                  <Clock3 className="h-3 w-3" />
                                  {offer.duration}
                                </span>
                                {offer.domain !== "random" &&
                                offer.domain !== "custom" ? (
                                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    @{offer.domain}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 truncate text-[11px] text-muted-foreground">
                                Works for · {offer.worksFor.join(", ")}
                              </p>
                            </div>
                          </div>
                          <p className="shrink-0 text-base font-bold text-primary">
                            {formatMoney(offer.price)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {offers.length === 0 ? (
                  <p className="rounded-[16px] bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
                    No email rentals match this duration.
                  </p>
                ) : null}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <h2 className="text-base font-semibold text-foreground">
                Order summary
              </h2>
              <div className="mt-4 space-y-3 text-sm">
                <SummaryRow
                  label="Mailbox"
                  value={selected?.provider ?? "—"}
                />
                <SummaryRow
                  label="Duration"
                  value={selected?.duration ?? "—"}
                />
                <SummaryRow
                  label="Category"
                  value={selected?.category ?? "—"}
                />
                <SummaryRow
                  label="Amount"
                  value={
                    selected ? formatMoney(selected.price) : formatMoney(0)
                  }
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
                <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Fulfillment via HeroSMS
                </p>
              </div>
            </MotionSection>

            <MotionSection
              delay={0.12}
              className="rounded-[22px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <h2 className="text-base font-semibold text-foreground">
                Instructions
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                How email rentals work on ORYNO
              </p>
              <ol className="mt-4 space-y-3">
                {EMAIL_INSTRUCTIONS.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-oryno-orange-muted text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <p className="pt-1 text-sm leading-relaxed text-foreground">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </MotionSection>

            <MotionSection delay={0.14}>
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
                    ? `Rent email · ${formatMoney(selected.price)}`
                    : "Continue"}
              </motion.button>
            </MotionSection>
          </form>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: typeof Clock3;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-white shadow-[var(--shadow-orange)]"
          : "bg-muted text-foreground hover:bg-oryno-orange-muted",
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
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
          "text-right font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
