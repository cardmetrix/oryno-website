"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Gift,
  Globe2,
  Smartphone,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import {
  VtpassServicePicker,
  type VtpassServiceOption,
} from "@/components/app/vtpass-service-picker";
import { ServiceLogo } from "@/components/app/service-logo";
import { useCountry } from "@/components/providers/country-provider";
import { airtimePresets, estimateAirtimeCashback } from "@/lib/telecom";
import { formatCountryMoney } from "@/lib/country";
import { cn } from "@/lib/utils";

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

type IntlCountry = {
  code: string;
  flag: string;
  name: string;
  currency: string;
  prefix: string;
};

type IntlOperator = {
  operator_id: string;
  name: string;
  operator_image?: string;
};

export default function AirtimePage() {
  const { country } = useCountry();
  const isNigeria = (country?.code || "NG") === "NG";

  const [services, setServices] = useState<VtpassServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceID, setServiceID] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("500");
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState("");

  // International
  const [intlCountries, setIntlCountries] = useState<IntlCountry[]>([]);
  const [countryIso, setCountryIso] = useState<string>(country?.code || "GH");
  const [operators, setOperators] = useState<IntlOperator[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationCode, setVariationCode] = useState("");
  const [loadingIntl, setLoadingIntl] = useState(false);

  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedVariation = variations.find(
    (v) => v.variationCode === variationCode,
  );
  const selectedOperator = operators.find((o) => o.operator_id === operatorId);

  const amountNumber = isNigeria
    ? Number(amount) || 0
    : selectedVariation?.amount || 0;
  const cashback = estimateAirtimeCashback(amountNumber);

  const canSubmit = useMemo(() => {
    const digits = phone.replace(/\D/g, "").length >= 10;
    if (!digits || submitting) return false;
    if (isNigeria) return Boolean(serviceID) && amountNumber >= 50;
    return Boolean(operatorId && variationCode && amountNumber > 0);
  }, [
    phone,
    submitting,
    isNigeria,
    serviceID,
    amountNumber,
    operatorId,
    variationCode,
  ]);

  useEffect(() => {
    if (!isNigeria) return;
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/vtpass/services?identifier=airtime");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load networks");
        if (cancelled) return;
        setServices(data.services ?? []);
        if (data.services?.[0]?.serviceID) {
          setServiceID(data.services[0].serviceID);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load networks");
        }
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNigeria]);

  useEffect(() => {
    if (isNigeria) return;
    let cancelled = false;
    (async () => {
      setLoadingIntl(true);
      try {
        const res = await fetch("/api/vtpass/international/countries");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load countries");
        if (cancelled) return;
        const list: IntlCountry[] = data.countries ?? [];
        setIntlCountries(list);
        const preferred =
          list.find((c) => c.code === country?.code)?.code ||
          list.find((c) => c.code !== "NG")?.code ||
          list[0]?.code ||
          "GH";
        setCountryIso(preferred);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load countries");
        }
      } finally {
        if (!cancelled) setLoadingIntl(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNigeria, country?.code]);

  useEffect(() => {
    if (isNigeria || !countryIso) return;
    let cancelled = false;
    (async () => {
      setLoadingIntl(true);
      setOperators([]);
      setOperatorId("");
      setVariations([]);
      setVariationCode("");
      try {
        const typesRes = await fetch(
          `/api/vtpass/international/product-types?code=${countryIso}`,
        );
        const typesData = await typesRes.json();
        if (!typesRes.ok) throw new Error(typesData.error);
        const topUp =
          (typesData.productTypes as { product_type_id: number; name: string }[])?.find(
            (t) => /top\s*up|airtime/i.test(t.name),
          ) || typesData.productTypes?.[0];
        if (!topUp) return;

        const opRes = await fetch(
          `/api/vtpass/international/operators?code=${countryIso}&product_type_id=${topUp.product_type_id}`,
        );
        const opData = await opRes.json();
        if (!opRes.ok) throw new Error(opData.error);
        if (cancelled) return;
        setOperators(opData.operators ?? []);
        if (opData.operators?.[0]?.operator_id) {
          setOperatorId(opData.operators[0].operator_id);
        }
        setProductTypeId(topUp.product_type_id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load operators");
        }
      } finally {
        if (!cancelled) setLoadingIntl(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNigeria, countryIso]);

  const [productTypeId, setProductTypeId] = useState<number>(1);

  useEffect(() => {
    if (isNigeria || !countryIso || !operatorId) return;
    let cancelled = false;
    (async () => {
      try {
        const typesRes = await fetch(
          `/api/vtpass/international/product-types?code=${countryIso}`,
        );
        const typesData = await typesRes.json();
        const topUp =
          (typesData.productTypes as { product_type_id: number; name: string }[])?.find(
            (t) => /top\s*up|airtime/i.test(t.name),
          ) || typesData.productTypes?.[0];
        const pt = topUp?.product_type_id ?? 1;
        setProductTypeId(pt);

        const res = await fetch(
          `/api/vtpass/variations?serviceID=foreign-airtime&operator_id=${operatorId}&product_type_id=${pt}`,
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load packages");
        if (cancelled) return;
        setVariations(data.variations ?? []);
        if (data.variations?.[0]?.variationCode) {
          setVariationCode(data.variations[0].variationCode);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load packages");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isNigeria, countryIso, operatorId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vtpass/purchase/airtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNigeria
            ? {
                mode: "local",
                serviceID,
                phone,
                amount: amountNumber,
                saveBeneficiary,
              }
            : {
                mode: "international",
                phone,
                amount: amountNumber,
                operatorId,
                countryIso,
                productTypeId,
                variationCode,
                saveBeneficiary,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setReceiptAmount(data.amountFormatted);
      setWalletLabel(data.wallet?.balanceFormatted ?? null);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  const money = (n: number) =>
    formatCountryMoney(n, country?.code || "NG");

  return (
    <AppShell hideNav>
      <PageHeader
        title="Buy Airtime"
        subtitle={
          isNigeria
            ? "MTN, Airtel, Glo & 9mobile via VTpass"
            : "International airtime for your country"
        }
        backHref="/dashboard"
      />

      <AnimatePresence mode="wait">
        {success ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border bg-background p-5 text-center shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
              </span>
              <h2 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">
                Airtime sent
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {receiptAmount || money(amountNumber)} sent to {phone}
                {isNigeria && selectedService
                  ? ` · ${selectedService.name}`
                  : selectedOperator
                    ? ` · ${selectedOperator.name}`
                    : ""}
              </p>
              {isNigeria ? (
                <p className="mt-3 text-sm font-semibold text-primary">
                  Cashback: {money(cashback)}
                </p>
              ) : null}
              {walletLabel ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Wallet balance {walletLabel}
                </p>
              ) : null}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => setSuccess(false)}
                  className="btn-primary h-12 w-full px-6 sm:w-auto"
                >
                  Buy again
                </button>
                <a
                  href="/dashboard"
                  className="btn-secondary inline-flex h-12 w-full items-center justify-center px-6 sm:w-auto"
                >
                  Back to Home
                </a>
              </div>
            </motion.div>
          </MotionSection>
        ) : (
          <form key="form" onSubmit={onSubmit} className="space-y-4 sm:space-y-5">
            {!isNigeria ? (
              <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                    <Globe2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">International airtime</h2>
                    <p className="text-xs text-muted-foreground">
                      Based on your country · VTpass foreign-airtime
                    </p>
                  </div>
                </div>

                <label className="mb-2 block text-sm font-medium">Country</label>
                <select
                  value={countryIso}
                  onChange={(e) => setCountryIso(e.target.value)}
                  className="mb-4 h-12 w-full rounded-[14px] border border-border bg-background px-3 text-sm"
                >
                  {intlCountries.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} (+{c.prefix})
                    </option>
                  ))}
                </select>

                <label className="mb-2 block text-sm font-medium">Operator</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {loadingIntl
                    ? Array.from({ length: 2 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-16 animate-pulse rounded-[16px] bg-muted"
                        />
                      ))
                    : operators.map((op) => (
                        <button
                          key={op.operator_id}
                          type="button"
                          onClick={() => setOperatorId(op.operator_id)}
                          className={cn(
                            "flex items-center gap-3 rounded-[16px] border px-3 py-3 text-left",
                            operatorId === op.operator_id
                              ? "border-primary bg-oryno-orange-muted"
                              : "border-border",
                          )}
                        >
                          <ServiceLogo
                            src={op.operator_image}
                            alt={op.name}
                          />
                          <span className="text-sm font-semibold">{op.name}</span>
                        </button>
                      ))}
                </div>
              </MotionSection>
            ) : (
              <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Select network</h2>
                    <p className="text-xs text-muted-foreground">
                      Logos from VTpass · Airtime VTU
                    </p>
                  </div>
                </div>
                <VtpassServicePicker
                  services={services}
                  value={serviceID}
                  onChange={setServiceID}
                  loading={loadingServices}
                />
              </MotionSection>
            )}

            <MotionSection
              delay={0.05}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="mb-2 block text-sm font-medium">Phone number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={isNigeria ? "0803 000 0000" : "Recipient number"}
                className="h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
              <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveBeneficiary}
                  onChange={(e) => setSaveBeneficiary(e.target.checked)}
                  className="rounded border-border"
                />
                Save as beneficiary
              </label>
            </MotionSection>

            {isNigeria ? (
              <MotionSection
                delay={0.08}
                className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
              >
                <label className="mb-2 block text-sm font-medium">Amount</label>
                <div className="relative">
                  <span className="absolute top-1/2 left-4 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                    ₦
                  </span>
                  <input
                    type="number"
                    min={50}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-12 w-full rounded-[14px] border border-border bg-background pr-4 pl-9 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {airtimePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(preset)}
                      className={cn(
                        "rounded-full px-3.5 py-2 text-sm font-semibold",
                        amount === preset
                          ? "bg-primary text-white"
                          : "bg-muted text-foreground",
                      )}
                    >
                      ₦{preset}
                    </button>
                  ))}
                </div>
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Gift className="h-3.5 w-3.5 text-primary" />
                  Est. cashback {money(cashback)}
                </p>
              </MotionSection>
            ) : (
              <MotionSection
                delay={0.08}
                className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
              >
                <h2 className="mb-3 text-base font-semibold">Top-up packages</h2>
                <div className="grid gap-2">
                  {variations.map((v) => (
                    <button
                      key={v.variationCode}
                      type="button"
                      onClick={() => setVariationCode(v.variationCode)}
                      className={cn(
                        "flex items-center justify-between rounded-[16px] border px-4 py-3 text-left",
                        variationCode === v.variationCode
                          ? "border-primary bg-oryno-orange-muted"
                          : "border-border",
                      )}
                    >
                      <span className="text-sm font-semibold">{v.name}</span>
                      <span className="text-sm font-bold text-primary">
                        {money(v.amount)}
                      </span>
                    </button>
                  ))}
                  {!variations.length ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {loadingIntl
                        ? "Loading packages…"
                        : "No packages for this operator"}
                    </p>
                  ) : null}
                </div>
              </MotionSection>
            )}

            <MotionSection
              delay={0.1}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row
                  label="Network"
                  value={
                    isNigeria
                      ? selectedService?.name ?? "—"
                      : selectedOperator?.name ?? "—"
                  }
                />
                <Row label="Phone" value={phone || "—"} />
                <Row label="Amount" value={money(amountNumber)} accent />
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <Wallet className="h-4 w-4 text-primary" />
                    Pay from wallet
                  </span>
                </div>
              </div>
            </MotionSection>

            {error ? (
              <p className="rounded-[14px] bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <motion.button
              type="submit"
              disabled={!canSubmit}
              whileTap={canSubmit ? { scale: 0.985 } : undefined}
              className="btn-primary h-12 w-full text-base disabled:opacity-50 sm:max-w-md"
            >
              {submitting
                ? "Processing…"
                : `Buy airtime · ${money(amountNumber)}`}
            </motion.button>
          </form>
        )}
      </AnimatePresence>
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
