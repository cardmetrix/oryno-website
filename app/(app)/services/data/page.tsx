"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ContactRound,
  Sparkles,
  Wifi,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { NetworkPicker } from "@/components/app/network-picker";
import { PageHeader } from "@/components/app/page-header";
import {
  dataCategories,
  dataPlans,
  formatNaira,
  NetworkId,
  networks,
} from "@/lib/telecom";
import { cn } from "@/lib/utils";

export default function DataPage() {
  const [network, setNetwork] = useState<NetworkId>("mtn");
  const [phone, setPhone] = useState("0803 111 2222");
  const [category, setCategory] =
    useState<(typeof dataCategories)[number]>("Daily");
  const [planId, setPlanId] = useState("mtn-d1");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const selectedNetwork = networks.find((n) => n.id === network)!;
  const walletBalance = 1245600;

  const filteredPlans = useMemo(
    () =>
      dataPlans.filter(
        (plan) => plan.network === network && plan.category === category,
      ),
    [network, category],
  );

  const selectedPlan =
    filteredPlans.find((plan) => plan.id === planId) ?? filteredPlans[0];

  const canSubmit = useMemo(
    () =>
      phone.replace(/\D/g, "").length >= 10 && Boolean(selectedPlan),
    [phone, selectedPlan],
  );

  function handleNetworkChange(id: NetworkId) {
    setNetwork(id);
    const next = dataPlans.find(
      (plan) => plan.network === id && plan.category === category,
    );
    if (next) setPlanId(next.id);
  }

  function handleCategoryChange(next: (typeof dataCategories)[number]) {
    setCategory(next);
    const match = dataPlans.find(
      (plan) => plan.network === network && plan.category === next,
    );
    if (match) setPlanId(match.id);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting || !selectedPlan) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
    }, 900);
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Buy Data"
        subtitle="Pick a fast bundle and activate instantly"
        backHref="/dashboard"
      />

      <AnimatePresence mode="wait">
        {success && selectedPlan ? (
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
                Data activated
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selectedPlan.size} · {selectedPlan.validity} on{" "}
                {selectedNetwork.name} was sent to {phone}.
              </p>
              <p className="mt-3 text-sm font-semibold text-primary">
                Charged {formatNaira(selectedPlan.price)} from wallet
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <motion.button
                  type="button"
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSuccess(false)}
                  className="btn-primary h-12 px-6"
                >
                  Buy again
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
                  <Wifi className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Select Network
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Bundles update for your network
                  </p>
                </div>
              </div>
              <NetworkPicker value={network} onChange={handleNetworkChange} />
            </MotionSection>

            <MotionSection
              delay={0.06}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Phone Number
                </span>
                <div className="mt-2 flex h-14 items-center gap-3 rounded-[16px] border border-border bg-muted/40 px-4 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
                  <ContactRound
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    strokeWidth={1.75}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0803 111 2222"
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
                    Choose a plan
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Daily, weekly, or monthly packs
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 rounded-[16px] bg-muted/70 p-1.5">
                {dataCategories.map((item) => {
                  const active = category === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleCategoryChange(item)}
                      className={cn(
                        "relative rounded-[12px] px-2 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="data-category"
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

              <div className="grid gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredPlans.map((plan, index) => {
                    const active = selectedPlan?.id === plan.id;
                    return (
                      <motion.button
                        key={plan.id}
                        type="button"
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ delay: index * 0.04, duration: 0.3 }}
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => setPlanId(plan.id)}
                        className={cn(
                          "relative overflow-hidden rounded-[20px] border px-4 py-4 text-left transition-colors",
                          active
                            ? "border-primary bg-oryno-orange-muted shadow-[var(--shadow-soft)]"
                            : "border-border bg-background hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-bold tracking-tight text-foreground">
                                {plan.size}
                              </p>
                              {plan.popular ? (
                                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold tracking-wide text-white uppercase">
                                  Popular
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm font-medium text-foreground">
                              {plan.name}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Valid for {plan.validity}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-bold text-primary">
                              {formatNaira(plan.price)}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {active ? "Selected" : "Tap to select"}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>

                {filteredPlans.length === 0 ? (
                  <p className="rounded-[16px] bg-muted/60 px-4 py-6 text-center text-sm text-muted-foreground">
                    No plans available for this filter.
                  </p>
                ) : null}
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
                <SummaryRow label="Network" value={selectedNetwork.name} />
                <SummaryRow label="Phone" value={phone || "—"} />
                <SummaryRow
                  label="Plan"
                  value={
                    selectedPlan
                      ? `${selectedPlan.size} · ${selectedPlan.validity}`
                      : "—"
                  }
                />
                <SummaryRow
                  label="Amount"
                  value={
                    selectedPlan ? formatNaira(selectedPlan.price) : formatNaira(0)
                  }
                  accent
                />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    Wallet balance
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatNaira(walletBalance)}
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
                  : selectedPlan
                    ? `Buy Data · ${formatNaira(selectedPlan.price)}`
                    : "Buy Data"}
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
