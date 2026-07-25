"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Hash,
  Receipt,
  Tv,
  Wallet,
  Zap,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  activeCountryConfig,
  billCategories,
  formatMoney,
} from "@/lib/services-catalog";
import { cn } from "@/lib/utils";

const amountPresets = ["1000", "2000", "5000", "10000"];

export default function BillsPage() {
  const { billProviders, currencySymbol } = activeCountryConfig;
  const [category, setCategory] =
    useState<(typeof billCategories)[number]>("All");
  const [providerId, setProviderId] = useState(billProviders[0]?.id ?? "");
  const [meterOrSmartcard, setMeterOrSmartcard] = useState("4578129034");
  const [amount, setAmount] = useState("5000");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const providers = useMemo(
    () =>
      category === "All"
        ? billProviders
        : billProviders.filter((p) => p.category === category),
    [category, billProviders],
  );

  const provider =
    providers.find((p) => p.id === providerId) ?? providers[0] ?? null;
  const amountNumber = Number(amount) || 0;
  const walletBalance = 1245600;
  const isTv = provider?.category === "TV";

  const canSubmit =
    Boolean(provider) &&
    meterOrSmartcard.trim().length >= 6 &&
    amountNumber >= 100;

  function onCategoryChange(next: (typeof billCategories)[number]) {
    setCategory(next);
    const list =
      next === "All"
        ? billProviders
        : billProviders.filter((p) => p.category === next);
    if (list[0]) setProviderId(list[0].id);
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
        title="Bill Payments"
        subtitle="Electricity & TV — paid from your wallet"
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success && provider ? (
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
                Payment successful
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatMoney(amountNumber)} paid to {provider.name} for{" "}
                {meterOrSmartcard}.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSuccess(false)}
                  className="btn-primary h-12 px-6"
                >
                  Pay another bill
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
                  <Receipt className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Select provider
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    From your country service configuration
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 rounded-[16px] bg-muted/70 p-1.5">
                {billCategories.map((item) => {
                  const active = category === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => onCategoryChange(item)}
                      className={cn(
                        "relative rounded-[12px] px-2 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="bill-category"
                          className="absolute inset-0 rounded-[12px] bg-background shadow-[var(--shadow-soft)]"
                          transition={{
                            type: "spring",
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      ) : null}
                      <span className="relative z-10">{item}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {providers.map((item, index) => {
                  const active = provider?.id === item.id;
                  const Icon = item.category === "TV" ? Tv : Zap;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setProviderId(item.id)}
                      className={cn(
                        "rounded-[18px] border px-4 py-4 text-left transition-colors",
                        active
                          ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-11 w-11 items-center justify-center rounded-2xl text-white"
                          style={{
                            background: item.accent ?? "var(--oryno-orange)",
                          }}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.75} />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    </motion.button>
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
                  {isTv ? "Smartcard / IUC Number" : "Meter Number"}
                </span>
                <div className="mt-2 flex h-14 items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <Hash
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <input
                    value={meterOrSmartcard}
                    onChange={(e) => setMeterOrSmartcard(e.target.value)}
                    placeholder={isTv ? "e.g. 7012345678" : "e.g. 4578129034"}
                    required
                    className="w-full bg-transparent text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </label>

              <label className="mt-5 block">
                <span className="text-sm font-semibold text-foreground">
                  Amount
                </span>
                <div className="mt-2 flex h-16 items-center rounded-[18px] border-2 border-primary/80 bg-muted/30 px-4">
                  <span className="mr-2 text-xl font-semibold text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amountNumber.toLocaleString("en-NG")}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/[^\d]/g, "") || "0")
                    }
                    className="w-full bg-transparent text-3xl font-bold tracking-tight text-foreground outline-none"
                  />
                </div>
              </label>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {amountPresets.map((preset) => {
                  const active = amount === preset;
                  return (
                    <motion.button
                      key={preset}
                      type="button"
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setAmount(preset)}
                      className={cn(
                        "rounded-[14px] px-2 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-primary text-white shadow-[var(--shadow-orange)]"
                          : "bg-muted text-foreground hover:bg-oryno-orange-muted",
                      )}
                    >
                      {formatMoney(Number(preset))}
                    </motion.button>
                  );
                })}
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
                <SummaryRow label="Provider" value={provider?.name ?? "—"} />
                <SummaryRow label="Category" value={provider?.category ?? "—"} />
                <SummaryRow
                  label={isTv ? "Smartcard" : "Meter"}
                  value={meterOrSmartcard || "—"}
                />
                <SummaryRow
                  label="Amount"
                  value={formatMoney(amountNumber)}
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
                  : `Pay Bill · ${formatMoney(amountNumber)}`}
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
          "text-right font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
