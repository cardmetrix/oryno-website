"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Droplets,
  Search,
  Tv,
  Wallet,
  Zap,
} from "lucide-react";
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

type BillCategory = "tv" | "electricity" | "water";

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const NG_PRESETS = ["1000", "2000", "5000", "10000"];
const GH_PRESETS = ["20", "50", "100", "200", "500"];
const KE_PRESETS = ["200", "500", "1000", "2000", "5000"];
const ZA_PRESETS = ["50", "100", "200", "500", "1000"];

export default function BillsPage() {
  const { country, formatServiceMoney } = useCountry();
  const { canAfford, frozen } = useWalletBalance();
  const isNigeria = (country?.code || "NG") === "NG";
  const isGhana = (country?.code || "NG") === "GH";
  const isKenya = (country?.code || "NG") === "KE";
  const isSouthAfrica = (country?.code || "NG") === "ZA";
  const localCurrencyBills = isGhana || isKenya || isSouthAfrica;
  const billsLive = isNigeria || localCurrencyBills;
  const hasWaterTab = isGhana || isKenya || isSouthAfrica;
  const minBillAmount = isSouthAfrica ? 10 : isKenya ? 50 : isGhana ? 1 : 100;

  const [category, setCategory] = useState<BillCategory>("tv");
  const [services, setServices] = useState<VtpassServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceID, setServiceID] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState("");
  const [customerRef, setCustomerRef] = useState("");
  const [amount, setAmount] = useState(
    isSouthAfrica ? "100" : isKenya ? "500" : isGhana ? "50" : "2000",
  );
  const [verifying, setVerifying] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedVariation = variations.find(
    (v) => v.variationCode === variationCode,
  );

  const amountNumber = useMemo(() => {
    if (category === "tv" && selectedVariation?.fixedPrice) {
      return selectedVariation.amount;
    }
    return Number(amount) || 0;
  }, [category, selectedVariation, amount]);

  const canSubmit = useMemo(() => {
    return (
      Boolean(serviceID && variationCode && customerRef.trim().length >= 6) &&
      amountNumber >= minBillAmount &&
      !submitting &&
      billsLive &&
      !frozen &&
      canAfford(amountNumber)
    );
  }, [
    serviceID,
    variationCode,
    customerRef,
    amountNumber,
    submitting,
    minBillAmount,
    billsLive,
    frozen,
    canAfford,
  ]);

  useEffect(() => {
    if (!billsLive) return;
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      setServiceID("");
      setVariations([]);
      setVariationCode("");
      setCustomerName(null);
      try {
        const identifier =
          category === "tv"
            ? "tv-subscription"
            : category === "water"
              ? "water-bill"
              : "electricity-bill";
        const res = await fetch(
          `/api/vtpass/services?identifier=${identifier}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load providers");
        if (cancelled) return;
        setServices(data.services ?? []);
        if (data.services?.[0]?.serviceID) {
          setServiceID(data.services[0].serviceID);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to load providers",
          );
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, billsLive]);

  useEffect(() => {
    if (!serviceID) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      setVariationCode("");
      try {
        const res = await fetch(
          `/api/vtpass/variations?serviceID=${encodeURIComponent(serviceID)}&identifier=${
            category === "tv"
              ? "tv-subscription"
              : category === "water"
                ? "water-bill"
                : "electricity-bill"
          }`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load plans");
        if (cancelled) return;
        setVariations(data.variations ?? []);
        if (data.variations?.[0]?.variationCode) {
          setVariationCode(data.variations[0].variationCode);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load plans");
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceID, category]);

  async function verifyCustomer() {
    if (!serviceID || customerRef.trim().length < 6) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/vtpass/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billersCode: customerRef.trim(),
          serviceID,
          category,
          type: variationCode || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setCustomerName(data.customerName || "Verified customer");
      if (data.renewalAmount) {
        setAmount(String(Math.round(Number(data.renewalAmount))));
      }
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
      const res = await fetch("/api/vtpass/purchase/bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceID,
          serviceName: selectedService.name,
          category,
          customerRef: customerRef.trim(),
          amount: amountNumber,
          variationCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");
      setReceipt(data.amountFormatted);
      setToken(data.token || null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
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
  const billsSubtitle = isSouthAfrica
    ? "DStv, Eskom & Johannesburg Water"
    : isKenya
      ? "DStv, KPLC & Nairobi Water"
      : isGhana
        ? "DStv, ECG & Ghana Water"
        : "TV subscriptions & electricity";
  const customerLabel =
    selectedService?.customerLabel ||
    (category === "tv"
      ? "Smartcard / IUC"
      : category === "water"
        ? "Account number"
        : "Meter number");

  if (!billsLive) {
    return (
      <AppShell hideNav>
        <PageHeader
          title="Bill Payments"
          subtitle="TV & electricity"
          backHref="/services"
        />
        <MotionSection className="rounded-2xl border border-border bg-background p-6 text-center shadow-[var(--shadow-soft)]">
          <Zap className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 text-lg font-bold">
            {country.name} bills coming next
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {country.name} bills will go live next. Airtime and data already work.
          </p>
          <a href="/services/airtime" className="btn-primary mt-6 inline-flex h-12 items-center px-6">
            Buy airtime instead
          </a>
        </MotionSection>
      </AppShell>
    );
  }

  return (
    <AppShell hideNav>
      <PageHeader
        title="Bill Payments"
        subtitle={billsSubtitle}
        backHref="/services"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <ServiceSuccess
              title="Bill paid!"
              subtitle={`${selectedService?.name || "Bill"} paid successfully.`}
              amountLabel="Amount charged"
              amount={receipt || money(amountNumber)}
              onDismiss={() => setSuccess(false)}
              secondaryAction={{
                label: "Back to Home",
                href: "/dashboard",
                icon: "home",
              }}
              tertiaryAction={{
                label: "Pay another bill",
                onClick: () => {
                  setSuccess(false);
                  setToken(null);
                },
                icon: "plus",
              }}
            >
              {token ? (
                <p className="break-all rounded-[14px] border border-border bg-muted/50 px-3 py-2 text-xs font-medium">
                  Token / receipt: {token}
                </p>
              ) : null}
            </ServiceSuccess>
          </MotionSection>
        ) : (
          <form key="form" onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <div className={cn(
                "grid gap-2 rounded-[14px] bg-muted/70 p-1",
                hasWaterTab ? "grid-cols-3" : "grid-cols-2",
              )}>
                {(
                  [
                    { id: "tv" as const, label: "TV", icon: Tv },
                    { id: "electricity" as const, label: "Electricity", icon: Zap },
                    ...(hasWaterTab
                      ? [{ id: "water" as const, label: "Water", icon: Droplets }]
                      : []),
                  ] as const
                ).map((tab) => {
                  const active = category === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setCategory(tab.id)}
                      className={cn(
                        "relative flex items-center justify-center gap-2 rounded-[12px] px-3 py-2.5 text-sm font-semibold",
                        active ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="bill-cat"
                          className="absolute inset-0 rounded-[12px] bg-background shadow-[var(--shadow-soft)]"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      ) : null}
                      <span className="relative z-10 inline-flex items-center gap-1.5">
                        <Icon className="h-4 w-4" />
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </MotionSection>

            <MotionSection
              delay={0.04}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="mb-3 text-base font-semibold">
                {category === "tv"
                  ? "TV providers"
                  : category === "water"
                    ? "Water"
                    : localCurrencyBills
                      ? "Electricity"
                      : "Electricity discos"}
              </h2>
              <div className="md:hidden">
                <SelectSheet
                  label="Provider"
                  title={
                    category === "tv"
                      ? "Select TV provider"
                      : category === "water"
                        ? "Select water utility"
                        : localCurrencyBills
                          ? "Select electricity provider"
                          : "Select electricity disco"
                  }
                  subtitle={
                    category === "tv"
                      ? isSouthAfrica || isKenya || isGhana
                        ? "DStv, GOtv, StarTimes"
                        : "DSTV, GOtv, Startimes & more"
                      : category === "water"
                        ? isSouthAfrica
                          ? "Johannesburg Water"
                          : isKenya
                            ? "Nairobi Water"
                            : "Ghana Water Company"
                        : isSouthAfrica
                          ? "Eskom & City Power"
                          : isKenya
                            ? "KPLC prepaid & postpaid"
                            : isGhana
                              ? "ECG prepaid & postpaid"
                              : "Prepaid & postpaid discos"
                  }
                  hint="Tap to choose a provider"
                  value={serviceID}
                  valueLabel={selectedService?.name}
                  valueImage={selectedService?.image}
                  onChange={setServiceID}
                  loading={loadingServices}
                  emptyText="No providers available"
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
                  onChange={setServiceID}
                  loading={loadingServices}
                  columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                />
              </div>
            </MotionSection>

            <MotionSection
              delay={0.06}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="mb-2 block text-sm font-medium">
                {customerLabel}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={customerRef}
                  onChange={(e) => {
                    setCustomerRef(e.target.value);
                    setCustomerName(null);
                  }}
                  placeholder={
                    customerLabel
                  }
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
              <SelectSheet
                label={
                  category === "tv"
                    ? "Plan"
                    : category === "water"
                      ? "Bill type"
                      : "Meter type"
                }
                title={
                  category === "tv" ? "Select bouquet" : "Select meter type"
                }
                subtitle={
                  category === "tv"
                    ? "Available subscription plans"
                    : "Prepaid or postpaid"
                }
                hint="Tap to choose"
                value={variationCode}
                valueLabel={selectedVariation?.name}
                onChange={setVariationCode}
                loading={loadingPlans}
                emptyText="No plans available"
                options={variations.map((v) => ({
                  id: v.variationCode,
                  title: v.name,
                  trailing:
                    v.fixedPrice && v.amount > 0 ? money(v.amount) : undefined,
                }))}
              />

              {(category === "electricity" ||
                category === "water" ||
                (selectedVariation && !selectedVariation.fixedPrice)) && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium">Amount</label>
                  <input
                    type="number"
                    min={minBillAmount}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {amountPresets.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setAmount(p)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold",
                          amount === p
                            ? "bg-primary text-white"
                            : "bg-muted",
                        )}
                      >
                        {money(Number(p))}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Provider" value={selectedService?.name ?? "—"} />
                <Row
                  label={
                    category === "tv"
                      ? "Smartcard"
                      : category === "water"
                        ? "Account"
                        : "Meter"
                  }
                  value={customerRef || "—"}
                />
                <Row label="Plan" value={selectedVariation?.name ?? "—"} />
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
                ? "Processing…"
                : frozen
                  ? "Wallet unavailable"
                  : amountNumber > 0 && !canAfford(amountNumber)
                    ? "Insufficient balance"
                    : `Pay bill · ${money(amountNumber)}`}
            </motion.button>
          </form>
        )}
      </AnimatePresence>

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Bill Payments"
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
