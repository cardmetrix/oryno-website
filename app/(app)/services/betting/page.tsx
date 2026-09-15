"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import {
  VtpassServicePicker,
  type VtpassServiceOption,
} from "@/components/app/vtpass-service-picker";
import { SelectSheet } from "@/components/app/select-sheet";
import { useCountry } from "@/components/providers/country-provider";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
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
  const { canAfford, frozen } = useWalletBalance();

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
  const [verifyHint, setVerifyHint] = useState<string | null>(null);
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
      !verifying &&
      amountNumber >= minAmount &&
      !submitting &&
      !frozen &&
      canAfford(amountNumber)
    );
  }, [
    serviceID,
    customerRef,
    customerName,
    verifying,
    amountNumber,
    minAmount,
    submitting,
    frozen,
    canAfford,
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

  // Auto-verify betting account when ID is long enough (same pattern as bills).
  useEffect(() => {
    if (!serviceID || customerRef.trim().length < 6) {
      setCustomerName(null);
      setVerifying(false);
      setVerifyHint(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setVerifying(true);
      setVerifyHint(null);
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
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Verification failed");
        setCustomerName(data.customerName || "Verified customer");
        setVerifyHint(null);
      } catch (e) {
        if (cancelled) return;
        setCustomerName(null);
        setVerifyHint(
          e instanceof Error ? e.message : "Could not verify that account",
        );
      } finally {
        if (!cancelled) setVerifying(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [serviceID, customerRef]);

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
    setVerifyHint(null);
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
                    setVerifyHint(null);
                  }}
                  loading={loadingServices}
                  emptyText="No bookmakers available"
                  options={services.map((s) => ({
                    id: s.serviceID,
                    title: s.name,
                    image: s.image ?? null,
                    domain: s.domain,
                    imageFallbacks: s.imageFallbacks,
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
                    setVerifyHint(null);
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
              <input
                value={customerRef}
                onChange={(e) => {
                  setCustomerRef(e.target.value.replace(/\s+/g, ""));
                  setCustomerName(null);
                  setVerifyHint(null);
                }}
                placeholder="e.g. 12345678"
                inputMode="numeric"
                className="h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
              {verifying ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Checking account…
                </p>
              ) : customerName ? (
                <p className="mt-2 text-sm font-medium text-[var(--oryno-success)]">
                  {customerName}
                </p>
              ) : verifyHint ? (
                <p className="mt-2 text-sm text-destructive">{verifyHint}</p>
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
                <Row
                  label="Customer"
                  value={
                    verifying
                      ? "Checking…"
                      : customerName || (verifyHint ? "Not verified" : "—")
                  }
                />
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
                : frozen
                  ? "Wallet unavailable"
                  : !customerName
                    ? verifying
                      ? "Verifying account…"
                      : "Verify account to continue"
                  : amountNumber > 0 && !canAfford(amountNumber)
                    ? "Insufficient balance"
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
