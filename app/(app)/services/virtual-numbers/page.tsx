"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Phone,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  activeCountryConfig,
  formatMoney,
  VirtualNumberOffer,
} from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

const modes = ["All", "Buy", "Rent"] as const;

export default function VirtualNumbersPage() {
  const { virtualNumbers } = activeCountryConfig;
  const [mode, setMode] = useState<(typeof modes)[number]>("All");
  const [country, setCountry] = useState("All");
  const [offerId, setOfferId] = useState(virtualNumbers[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const walletBalance = 1245600;

  const countries = useMemo(() => {
    const unique = Array.from(
      new Map(
        virtualNumbers.map((n) => [
          n.countryCode,
          { code: n.countryCode, name: n.countryName, flag: n.flag },
        ]),
      ).values(),
    );
    return unique;
  }, [virtualNumbers]);

  const offers = useMemo(() => {
    return virtualNumbers.filter((offer) => {
      const modeOk = mode === "All" || offer.type === mode;
      const countryOk = country === "All" || offer.countryCode === country;
      return modeOk && countryOk;
    });
  }, [virtualNumbers, mode, country]);

  const selected: VirtualNumberOffer | null =
    offers.find((o) => o.id === offerId) ?? offers[0] ?? null;

  const canSubmit = Boolean(selected);

  function onModeChange(next: (typeof modes)[number]) {
    setMode(next);
    const nextOffers = virtualNumbers.filter((offer) => {
      const modeOk = next === "All" || offer.type === next;
      const countryOk = country === "All" || offer.countryCode === country;
      return modeOk && countryOk;
    });
    if (nextOffers[0]) setOfferId(nextOffers[0].id);
  }

  function onCountryChange(code: string) {
    setCountry(code);
    const nextOffers = virtualNumbers.filter((offer) => {
      const modeOk = mode === "All" || offer.type === mode;
      const countryOk = code === "All" || offer.countryCode === code;
      return modeOk && countryOk;
    });
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
        title="Virtual Numbers"
        subtitle="Buy permanently or rent for SMS verification"
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
                Number reserved
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.flag} {selected.countryName} · {selected.type} ·{" "}
                {selected.duration}. SMS inbox is ready in your numbers list.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSuccess(false)}
                  className="btn-primary h-12 px-6"
                >
                  Get another number
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
                  <Phone className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Buy or rent
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Permanent lines or short SMS rentals
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-[16px] bg-muted/70 p-1.5">
                {modes.map((item) => {
                  const active = mode === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onModeChange(item)}
                      className={cn(
                        "relative rounded-[12px] px-2 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="vn-mode"
                          className="absolute inset-0 rounded-[12px] bg-background shadow-[var(--shadow-soft)]"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      ) : null}
                      <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
                        {item === "Buy" ? (
                          <ShoppingBag className="h-3.5 w-3.5" />
                        ) : null}
                        {item === "Rent" ? (
                          <Clock3 className="h-3.5 w-3.5" />
                        ) : null}
                        {item}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <FilterChip
                  active={country === "All"}
                  onClick={() => onCountryChange("All")}
                  label="All countries"
                />
                {countries.map((c) => (
                  <FilterChip
                    key={c.code}
                    active={country === c.code}
                    onClick={() => onCountryChange(c.code)}
                    label={`${c.flag} ${c.name}`}
                  />
                ))}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.06}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <h2 className="mb-4 text-base font-semibold text-foreground">
                Available numbers
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
                          <div className="flex items-start gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-xl">
                              {offer.flag}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {offer.countryName}
                              </p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {offer.category} · {offer.duration}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                    offer.type === "Buy"
                                      ? "bg-primary text-white"
                                      : "bg-muted text-foreground",
                                  )}
                                >
                                  {offer.type}
                                </span>
                                {offer.smsCapable ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                    <MessageSquareText className="h-3 w-3" />
                                    SMS
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <p className="text-base font-bold text-primary">
                            {formatMoney(offer.price)}
                          </p>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {offers.length === 0 ? (
                  <p className="rounded-[16px] bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
                    No numbers match this filter.
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
                  label="Country"
                  value={
                    selected
                      ? `${selected.flag} ${selected.countryName}`
                      : "—"
                  }
                />
                <SummaryRow label="Type" value={selected?.type ?? "—"} />
                <SummaryRow
                  label="Duration"
                  value={selected?.duration ?? "—"}
                />
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
                    ? `${selected.type} number · ${formatMoney(selected.price)}`
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
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-white shadow-[var(--shadow-orange)]"
          : "bg-muted text-foreground hover:bg-oryno-orange-muted",
      )}
    >
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
