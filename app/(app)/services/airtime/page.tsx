"use client";

import { FormEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ContactRound,
  Gift,
  Smartphone,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { NetworkPicker } from "@/components/app/network-picker";
import { PageHeader } from "@/components/app/page-header";
import {
  airtimePresets,
  estimateAirtimeCashback,
  formatNaira,
  NetworkId,
  networks,
} from "@/lib/telecom";
import { cn } from "@/lib/utils";

export default function AirtimePage() {
  const [network, setNetwork] = useState<NetworkId>("mtn");
  const [phone, setPhone] = useState("0803 111 2222");
  const [amount, setAmount] = useState("500");
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const amountNumber = Number(amount) || 0;
  const cashback = estimateAirtimeCashback(amountNumber);
  const selectedNetwork = networks.find((n) => n.id === network)!;
  const walletBalance = 1245600;

  const canSubmit = useMemo(
    () => phone.replace(/\D/g, "").length >= 10 && amountNumber >= 50,
    [phone, amountNumber],
  );

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
        title="Buy Airtime"
        subtitle="Top up any line instantly with cashback"
        backHref="/dashboard"
      />

      <AnimatePresence mode="wait">
        {success ? (
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
                Airtime sent
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatNaira(amountNumber)} {selectedNetwork.name} airtime was
                sent to {phone}.
              </p>
              <p className="mt-3 text-sm font-semibold text-primary">
                Cashback earned: {formatNaira(cashback)}
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
                  <Smartphone className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Select Network
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Choose where to send airtime
                  </p>
                </div>
              </div>
              <NetworkPicker value={network} onChange={setNetwork} />
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

              <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveBeneficiary}
                  onChange={(e) => setSaveBeneficiary(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary accent-[var(--oryno-orange)]"
                />
                Save as beneficiary for next top-up
              </label>
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)] sm:p-6"
            >
              <label className="block">
                <span className="text-sm font-semibold text-foreground">
                  Amount
                </span>
                <div className="mt-2 flex h-16 items-center rounded-[18px] border-2 border-primary/80 bg-muted/30 px-4">
                  <span className="mr-2 text-xl font-semibold text-muted-foreground">
                    ₦
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

              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {airtimePresets.map((preset, index) => {
                  const active = amount === preset;
                  return (
                    <motion.button
                      key={preset}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 + index * 0.03 }}
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
                      ₦{Number(preset).toLocaleString()}
                    </motion.button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-start gap-3 rounded-[16px] bg-oryno-orange-muted px-4 py-3">
                <Gift className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm font-medium text-primary">
                  You will earn {formatNaira(cashback)} cashback on this
                  transaction.
                </p>
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
                <SummaryRow label="Amount" value={formatNaira(amountNumber)} />
                <SummaryRow
                  label="Cashback"
                  value={formatNaira(cashback)}
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
                  : `Buy Airtime · ${formatNaira(amountNumber)}`}
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
          "font-semibold",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
