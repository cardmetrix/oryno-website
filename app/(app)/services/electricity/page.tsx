"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Wallet, Zap } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { TelecomNetworkGrid } from "@/components/app/telecom-network-grid";
import { SelectSheet } from "@/components/app/select-sheet";
import type { VtpassServiceOption } from "@/components/app/vtpass-service-picker";
import { useCountry } from "@/components/providers/country-provider";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";
import { CurrencyAmountInput } from "@/components/app/currency-amount-input";

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const NG_PRESETS = ["1000", "2000", "5000", "10000", "20000"];
const GH_PRESETS = ["20", "50", "100", "200", "500"];
const KE_PRESETS = ["200", "500", "1000", "2000", "5000"];
const ZA_PRESETS = ["50", "100", "200", "500", "1000"];

export default function ElectricityPage() {
  const { country, formatServiceMoney } = useCountry();
  const { canAfford, frozen } = useWalletBalance();
  const countryCode = country?.code || "NG";
  const isNigeria = countryCode === "NG";
  const isGhana = countryCode === "GH";
  const isKenya = countryCode === "KE";
  const isSouthAfrica = countryCode === "ZA";
  const live = isNigeria || isGhana || isKenya || isSouthAfrica;
  const currencyPrefix = country?.currencySymbol ?? "₦";

  const [services, setServices] = useState<VtpassServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceID, setServiceID] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState("");
  const [meterNumber, setMeterNumber] = useState("");
  const [amount, setAmount] = useState(
    isSouthAfrica ? "100" : isKenya ? "500" : isGhana ? "50" : "2000",
  );
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [verifyHint, setVerifyHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const minAmount = isNigeria
    ? 1000
    : isSouthAfrica
      ? 10
      : isKenya
        ? 50
        : isGhana
          ? 1
          : 100;

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedVariation = variations.find(
    (v) => v.variationCode === variationCode,
  );
  const amountNumber = Number(amount) || 0;

  const canSubmit = useMemo(() => {
    const verifiedOk = !isNigeria || Boolean(customerName);
    return (
      Boolean(serviceID && variationCode && meterNumber.trim().length >= 6) &&
      verifiedOk &&
      !verifying &&
      amountNumber >= minAmount &&
      !submitting &&
      live &&
      !frozen &&
      canAfford(amountNumber)
    );
  }, [
    serviceID,
    variationCode,
    meterNumber,
    customerName,
    verifying,
    isNigeria,
    amountNumber,
    submitting,
    minAmount,
    live,
    frozen,
    canAfford,
  ]);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      setServiceID("");
      setVariations([]);
      setVariationCode("");
      setCustomerName(null);
      try {
        const res = await fetch(
          "/api/vtpass/services?identifier=electricity-bill",
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load discos");
        if (cancelled) return;
        setServices(data.services ?? []);
        if (data.services?.[0]?.serviceID) {
          setServiceID(data.services[0].serviceID);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load discos");
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live, countryCode]);

  useEffect(() => {
    if (!serviceID) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      setVariationCode("");
      try {
        const res = await fetch(
          `/api/vtpass/variations?serviceID=${encodeURIComponent(serviceID)}&identifier=electricity-bill`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load meter types");
        if (cancelled) return;
        setVariations(data.variations ?? []);
        if (data.variations?.[0]?.variationCode) {
          setVariationCode(data.variations[0].variationCode);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load meter types",
          );
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceID]);

  // Auto-verify meter when digits are long enough.
  useEffect(() => {
    if (!live || !serviceID || meterNumber.trim().length < 6) {
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
        const res = await fetch("/api/vtpass/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            billersCode: meterNumber.trim(),
            serviceID,
            category: "electricity",
            type: variationCode || undefined,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || "Verification failed");
        setCustomerName(data.customerName || "Verified customer");
        setVerifyHint(null);
        if (data.renewalAmount) {
          setAmount(String(Math.round(Number(data.renewalAmount))));
        }
      } catch (e) {
        if (cancelled) return;
        setCustomerName(null);
        setVerifyHint(
          e instanceof Error ? e.message : "Could not verify that meter",
        );
      } finally {
        if (!cancelled) setVerifying(false);
      }
    }, 800);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [live, serviceID, meterNumber, variationCode]);

  // Poll electricity token after async purchase.
  useEffect(() => {
    if (!pending || !paymentId) return;
    let cancelled = false;
    let attempts = 0;

    const tick = async () => {
      attempts += 1;
      try {
        const res = await fetch(
          `/api/vtpass/purchase/bill/status?paymentId=${encodeURIComponent(paymentId)}`,
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        if (data.token) setToken(String(data.token));
        if (data.status === "completed") {
          setPending(false);
          setSuccess(true);
          return;
        }
        if (data.status === "failed") {
          setPending(false);
          setSuccess(false);
          setError(data.failureReason || "Electricity payment failed");
          return;
        }
      } catch {
        // keep polling
      }
      if (!cancelled && attempts < 40) {
        window.setTimeout(tick, 3000);
      } else if (!cancelled) {
        setPending(false);
        setSuccess(true);
      }
    };

    const timer = window.setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pending, paymentId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selectedService) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vtpass/purchase/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceID,
          serviceName: selectedService.name,
          category: "electricity",
          customerRef: meterNumber.trim(),
          amount: amountNumber,
          variationCode,
          recipientName: customerName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setReceipt(data.amountFormatted);
      setToken(data.token || null);
      setPaymentId(data.paymentId || null);
      setTransactionId(data.transactionId || null);
      if (data.status === "processing" && !data.token) {
        setPending(true);
        setSuccess(true);
      } else {
        setPending(false);
        setSuccess(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  function resetSuccess() {
    setSuccess(false);
    setPending(false);
    setToken(null);
    setPaymentId(null);
    setTransactionId(null);
  }

  const money = (n: number) =>
    isSouthAfrica
      ? formatCountryMoney(n, "ZA")
      : isKenya
        ? formatCountryMoney(n, "KE")
        : isGhana
          ? formatCountryMoney(n, "GH")
          : formatServiceMoney(n);

  const amountPresets = isSouthAfrica
    ? ZA_PRESETS
    : isKenya
      ? KE_PRESETS
      : isGhana
        ? GH_PRESETS
        : NG_PRESETS;

  const subtitle = isSouthAfrica
    ? "Eskom & City Power"
    : isKenya
      ? "Kenya Power (KPLC)"
      : isGhana
        ? "ECG prepaid & postpaid"
        : "All major discos · prepaid & postpaid";

  const customerLabel =
    selectedService?.customerLabel || "Meter number";

  if (!live) {
    return (
      <AppShell hideNav>
        <PageHeader
          title="Electricity"
          subtitle="Prepaid & postpaid"
          backHref="/dashboard"
        />
        <MotionSection className="rounded-2xl bg-muted px-6 py-10 text-center">
          <Zap className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-lg font-bold">
            {country?.name || "Your country"} electricity coming next
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Electricity top-ups for {country?.name || "this market"} will go live
            soon. Airtime and data already work.
          </p>
          <a
            href="/services/airtime"
            className="btn-primary mt-6 inline-flex h-12 items-center px-6"
          >
            Buy airtime instead
          </a>
        </MotionSection>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <PageHeader title="Electricity" subtitle={subtitle} backHref="/dashboard" />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <ServiceSuccess
              variant={pending && !token ? "pending" : "success"}
              title={
                pending && !token
                  ? "Payment processing"
                  : token
                    ? "Token ready!"
                    : "Electricity paid!"
              }
              subtitle={
                pending && !token
                  ? `${selectedService?.name || "Disco"} is processing. Your token will appear here shortly.`
                  : `${selectedService?.name || "Electricity"} paid successfully.`
              }
              amountLabel="Amount charged"
              amount={receipt || money(amountNumber)}
              reference={transactionId}
              onDismiss={resetSuccess}
              secondaryAction={{
                label: "Back to Home",
                href: "/dashboard",
                icon: "home",
              }}
              tertiaryAction={{
                label: "Buy again",
                onClick: resetSuccess,
                icon: "plus",
              }}
            >
              {token ? (
                <p className="break-all rounded-[14px] border border-border bg-muted/50 px-3 py-2 text-xs font-medium">
                  Token / receipt: {token}
                </p>
              ) : pending ? (
                <p className="rounded-[14px] border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  Waiting for disco token… this usually takes a few seconds.
                </p>
              ) : null}
            </ServiceSuccess>
          </MotionSection>
        ) : (
          <form
            key="form"
            onSubmit={onSubmit}
            className="space-y-6 pb-8 sm:space-y-7"
          >
            <MotionSection className="space-y-3">
              <h2 className="text-[15px] font-bold text-foreground">
                Select Disco
              </h2>
              <TelecomNetworkGrid
                services={services}
                value={serviceID}
                onChange={(id) => {
                  setServiceID(id);
                  setCustomerName(null);
                  setVerifyHint(null);
                }}
                loading={loadingServices}
              />
            </MotionSection>

            <MotionSection delay={0.04} className="space-y-3">
              <h2 className="text-[15px] font-bold text-foreground">
                {customerLabel}
              </h2>
              <input
                value={meterNumber}
                onChange={(e) => {
                  setMeterNumber(e.target.value);
                  setCustomerName(null);
                  setVerifyHint(null);
                }}
                placeholder={customerLabel}
                inputMode="numeric"
                className="h-14 w-full rounded-2xl border-0 bg-muted px-4 text-[15px] font-medium outline-none focus:ring-2 focus:ring-primary/25"
              />
              {verifying ? (
                <p className="px-1 text-sm text-muted-foreground">
                  Checking meter…
                </p>
              ) : customerName ? (
                <p className="px-1 text-sm font-medium text-[var(--oryno-success)]">
                  {customerName}
                </p>
              ) : verifyHint ? (
                <p className="px-1 text-sm text-destructive">{verifyHint}</p>
              ) : (
                <p className="px-1 text-xs text-muted-foreground">
                  Enter at least 6 digits — we verify the account automatically.
                </p>
              )}
            </MotionSection>

            <MotionSection delay={0.06}>
              <SelectSheet
                label="Meter type"
                title="Select meter type"
                subtitle="Prepaid or postpaid"
                hint="Tap to choose"
                value={variationCode}
                valueLabel={selectedVariation?.name}
                onChange={setVariationCode}
                loading={loadingPlans}
                emptyText="No meter types available"
                options={variations.map((v) => ({
                  id: v.variationCode,
                  title: v.name,
                }))}
              />
            </MotionSection>

            <MotionSection delay={0.08} className="space-y-3">
              <h2 className="text-[15px] font-bold text-foreground">Amount</h2>
              <CurrencyAmountInput
                prefix={currencyPrefix}
                value={amount}
                onChange={setAmount}
                min={minAmount}
                className="h-14 rounded-2xl border-0 bg-muted focus-within:border-0 focus-within:ring-2 focus-within:ring-primary/25"
                inputClassName="text-[15px] font-medium"
              />
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
                {amountPresets.map((preset) => {
                  const active = amount === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={cn(
                        "rounded-2xl px-2 py-3.5 text-center transition",
                        active
                          ? "bg-primary text-white shadow-[var(--shadow-soft)]"
                          : "bg-muted text-foreground hover:bg-muted/80",
                      )}
                    >
                      <span className="block text-sm font-bold">
                        {money(Number(preset))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {isNigeria ? (
                <p className="px-1 text-xs text-muted-foreground">
                  Minimum top-up is {money(minAmount)}.
                </p>
              ) : null}
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-2xl bg-muted/70 px-4 py-4"
            >
              <div className="space-y-2 text-sm">
                <Row label="Disco" value={selectedService?.name ?? "—"} />
                <Row label="Meter" value={meterNumber || "—"} />
                <Row label="Type" value={selectedVariation?.name ?? "—"} />
                <Row label="Amount" value={money(amountNumber)} accent />
                <div className="flex items-center gap-2 border-t border-border/70 pt-3 font-semibold">
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
                ? "Processing…"
                : frozen
                  ? "Wallet unavailable"
                  : isNigeria && !customerName
                    ? verifying
                      ? "Verifying meter…"
                      : "Verify meter to continue"
                    : amountNumber > 0 && !canAfford(amountNumber)
                      ? "Insufficient balance"
                      : `Pay electricity · ${money(amountNumber)}`}
            </motion.button>
          </form>
        )}
      </AnimatePresence>

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Electricity"
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
