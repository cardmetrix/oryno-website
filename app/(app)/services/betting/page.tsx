"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search, Wallet } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { ServiceInstructions } from "@/components/app/service-instructions";
import {
  VtpassServicePicker,
  type VtpassServiceOption,
} from "@/components/app/vtpass-service-picker";
import { SelectSheet } from "@/components/app/select-sheet";
import { useCountry } from "@/components/providers/country-provider";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";

type DemoTest = {
  customerId: string;
  name: string | null;
  outcome: "success" | "verify_fail" | "fund_fail";
  note: string;
};

const FALLBACK_PRESETS = ["500", "1000", "2000", "5000", "10000"];

export default function BettingPage() {
  const { country } = useCountry();

  const [services, setServices] = useState<VtpassServiceOption[]>([]);
  const [presets, setPresets] = useState<string[]>(FALLBACK_PRESETS);
  const [demoTests, setDemoTests] = useState<DemoTest[]>([]);
  const [demoMode, setDemoMode] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceID, setServiceID] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [amount, setAmount] = useState("2000");
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const amountNumber = Number(amount) || 0;
  const minAmount = selectedService?.minAmount ?? 100;

  const canSubmit = useMemo(() => {
    return (
      Boolean(serviceID && customerRef.trim().length >= 6 && customerName) &&
      amountNumber >= minAmount &&
      !submitting
    );
  }, [
    serviceID,
    customerRef,
    customerName,
    amountNumber,
    minAmount,
    submitting,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/betting/providers", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load bookmakers");
        if (cancelled) return;
        const next = (data.services ?? []) as VtpassServiceOption[];
        setServices(next);
        const nextPresets = (data.presets ?? FALLBACK_PRESETS) as string[];
        setPresets(nextPresets);
        setDemoTests(data.demoTests ?? []);
        setDemoMode(Boolean(data.demo));
        if (next[0]?.serviceID) setServiceID(next[0].serviceID);
        if (nextPresets[1] || nextPresets[0]) {
          setAmount(nextPresets[1] || nextPresets[0]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load bookmakers");
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [country.code]);

  async function verifyCustomer() {
    if (!serviceID || customerRef.trim().length < 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/betting/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceID,
          customerRef: customerRef.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setCustomerName(data.customerName || "Verified customer");
    } catch (e) {
      setCustomerName(null);
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/betting/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceID,
          serviceName: selectedService.name,
          customerRef: customerRef.trim(),
          customerName,
          amount: amountNumber,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Funding failed");
      setReceipt(data.amountFormatted);
      setToken(data.token || data.requestId || null);
      setTransactionId(data.transactionId || null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funding failed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSuccess(false);
    setToken(null);
    setTransactionId(null);
    setCustomerName(null);
  }

  const money = (n: number) => formatCountryMoney(n, country.code);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Betting Funding"
        subtitle={`Fund ${country.name} bookmakers from your wallet`}
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <ServiceSuccess
              title={demoMode ? "Demo wallet funded!" : "Betting wallet funded!"}
              subtitle={`${selectedService?.name || "Bookmaker"} credited successfully.`}
              amountLabel="Amount charged"
              amount={receipt || money(amountNumber)}
              onDismiss={resetForm}
              primaryAction={
                transactionId
                  ? {
                      label: "View receipt",
                      href: `/history/${transactionId}`,
                      icon: "receipt",
                    }
                  : undefined
              }
              secondaryAction={{
                label: "Back to Home",
                href: "/dashboard",
                icon: "home",
              }}
              tertiaryAction={{
                label: "Fund another account",
                onClick: resetForm,
                icon: "plus",
              }}
            >
              {token ? (
                <p className="break-all rounded-[14px] border border-border bg-muted/50 px-3 py-2 text-xs font-medium">
                  Reference: {token}
                </p>
              ) : null}
            </ServiceSuccess>
          </MotionSection>
        ) : (
          <form key="form" onSubmit={onSubmit} className="space-y-4 sm:space-y-5">

            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <h2 className="mb-3 text-base font-semibold">Bookmaker</h2>
              <div className="md:hidden">
                <SelectSheet
                  label="Bookmaker"
                  title="Select bookmaker"
                  subtitle="Bet9ja, SportyBet, 1xBet and more"
                  hint="Tap to choose a bookmaker"
                  value={serviceID}
                  valueLabel={selectedService?.name}
                  valueImage={selectedService?.image}
                  onChange={(id) => {
                    setServiceID(id);
                    setCustomerName(null);
                  }}
                  loading={loadingServices}
                  emptyText="No bookmakers available"
                  options={services.map((s) => ({
                    id: s.serviceID,
                    title: s.name,
                    image: s.image ?? null,
                    subtitle: "Tap to select",
                  }))}
                />
              </div>
              <div className="hidden md:block">
                <VtpassServicePicker
                  services={services}
                  value={serviceID}
                  onChange={(id) => {
                    setServiceID(id);
                    setCustomerName(null);
                  }}
                  loading={loadingServices}
                  columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                />
              </div>
            </MotionSection>

            <MotionSection
              delay={0.04}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="mb-2 block text-sm font-medium">
                Betting account ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={customerRef}
                  onChange={(e) => {
                    setCustomerRef(e.target.value.replace(/\s+/g, ""));
                    setCustomerName(null);
                  }}
                  placeholder="e.g. 12345678"
                  inputMode="numeric"
                  className="h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={verifyCustomer}
                  disabled={verifying || customerRef.trim().length < 6}
                  className="btn-secondary inline-flex h-12 shrink-0 items-center justify-center gap-2 px-4 disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  {verifying ? "Checking…" : "Verify"}
                </button>
              </div>
              {customerName ? (
                <p className="mt-2 text-sm font-medium text-[var(--oryno-success)]">
                  {customerName}
                </p>
              ) : null}
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="mb-2 block text-sm font-medium">Amount</label>
              <input
                type="number"
                min={minAmount}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold",
                      amount === p ? "bg-primary text-white" : "bg-muted",
                    )}
                  >
                    {money(Number(p))}
                  </button>
                ))}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Bookmaker" value={selectedService?.name ?? "—"} />
                <Row label="Account ID" value={customerRef || "—"} />
                <Row label="Customer" value={customerName || "Verify first"} />
                <Row label="Amount" value={money(amountNumber)} accent />
                <div className="flex items-center gap-2 border-t border-border pt-3 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  Pay from wallet
                </div>
              </div>
            </MotionSection>

            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileTap={canSubmit ? { scale: 0.985 } : undefined}
              className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
            >
              {submitting
                ? "Funding…"
                : `Fund wallet · ${money(amountNumber)}`}
            </motion.button>
          </form>
        )}
      </AnimatePresence>

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Betting Funding"
      />
    </AppShell>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "max-w-[60%] text-right font-semibold break-words",
          accent ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}
