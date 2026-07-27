"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Globe2, Wallet, Wifi } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceLogo } from "@/components/app/service-logo";
import {
  VtpassServicePicker,
  type VtpassServiceOption,
} from "@/components/app/vtpass-service-picker";
import { useCountry } from "@/components/providers/country-provider";
import { formatCountryMoney } from "@/lib/country";
import { inferDataPlanCategory } from "@/lib/vtpass/catalog";
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

const FILTERS = ["All", "Daily", "Weekly", "Monthly"] as const;

export default function DataPage() {
  const { country } = useCountry();
  const isNigeria = (country?.code || "NG") === "NG";

  const [services, setServices] = useState<VtpassServiceOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [serviceID, setServiceID] = useState("");
  const [phone, setPhone] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");

  const [intlCountries, setIntlCountries] = useState<IntlCountry[]>([]);
  const [countryIso, setCountryIso] = useState<string>(country?.code || "GH");
  const [operators, setOperators] = useState<IntlOperator[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [productTypeId, setProductTypeId] = useState(4);
  const [loadingIntl, setLoadingIntl] = useState(false);

  const selected = variations.find((v) => v.variationCode === variationCode);
  const selectedService = services.find((s) => s.serviceID === serviceID);
  const selectedOperator = operators.find((o) => o.operator_id === operatorId);

  const filtered = useMemo(() => {
    if (filter === "All") return variations;
    return variations.filter((v) => {
      const cat = inferDataPlanCategory(v.name);
      return cat === filter.toLowerCase();
    });
  }, [variations, filter]);

  const canSubmit = useMemo(() => {
    if (phone.replace(/\D/g, "").length < 10 || !selected || submitting) {
      return false;
    }
    if (isNigeria) return Boolean(serviceID);
    return Boolean(operatorId && countryIso && productTypeId);
  }, [
    phone,
    selected,
    submitting,
    isNigeria,
    serviceID,
    operatorId,
    countryIso,
    productTypeId,
  ]);

  useEffect(() => {
    if (!isNigeria) return;
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const res = await fetch("/api/vtpass/services?identifier=data");
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
    if (!isNigeria || !serviceID) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      setVariationCode("");
      try {
        const res = await fetch(
          `/api/vtpass/variations?serviceID=${encodeURIComponent(serviceID)}`,
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
  }, [isNigeria, serviceID]);

  useEffect(() => {
    if (isNigeria) return;
    let cancelled = false;
    (async () => {
      setLoadingIntl(true);
      try {
        const res = await fetch("/api/vtpass/international/countries");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
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
      try {
        const typesRes = await fetch(
          `/api/vtpass/international/product-types?code=${countryIso}`,
        );
        const typesData = await typesRes.json();
        if (!typesRes.ok) throw new Error(typesData.error);
        const dataType =
          (typesData.productTypes as { product_type_id: number; name: string }[])?.find(
            (t) => /data/i.test(t.name),
          ) || typesData.productTypes?.[0];
        if (!dataType) return;
        setProductTypeId(dataType.product_type_id);

        const opRes = await fetch(
          `/api/vtpass/international/operators?code=${countryIso}&product_type_id=${dataType.product_type_id}`,
        );
        const opData = await opRes.json();
        if (!opRes.ok) throw new Error(opData.error);
        if (cancelled) return;
        setOperators(opData.operators ?? []);
        if (opData.operators?.[0]?.operator_id) {
          setOperatorId(opData.operators[0].operator_id);
        }
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

  useEffect(() => {
    if (isNigeria || !countryIso || !operatorId) return;
    let cancelled = false;
    (async () => {
      setLoadingPlans(true);
      try {
        const res = await fetch(
          `/api/vtpass/variations?serviceID=foreign-airtime&operator_id=${operatorId}&product_type_id=${productTypeId}`,
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
  }, [isNigeria, countryIso, operatorId, productTypeId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/vtpass/purchase/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNigeria
            ? {
                mode: "local",
                serviceID,
                phone,
                variationCode: selected.variationCode,
                variationName: selected.name,
                amount: selected.amount,
              }
            : {
                mode: "international",
                phone,
                variationCode: selected.variationCode,
                variationName: selected.name,
                amount: selected.amount,
                operatorId,
                countryIso,
                productTypeId,
              },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setReceipt(data.amountFormatted);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setSubmitting(false);
    }
  }

  const money = (n: number) => formatCountryMoney(n, country?.code || "NG");

  return (
    <AppShell hideNav>
      <PageHeader
        title="Buy Data"
        subtitle={
          isNigeria
            ? "All networks · live VTpass plans"
            : "International data for your country"
        }
        backHref="/dashboard"
      />

      <AnimatePresence mode="wait">
        {success && selected ? (
          <MotionSection key="success">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-border bg-background p-5 text-center shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-8"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-oryno-orange-muted text-[var(--oryno-success)]">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <h2 className="mt-4 text-xl font-bold sm:text-2xl">Data sent</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {selected.name} · {receipt || money(selected.amount)} to {phone}
              </p>
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
            {isNigeria ? (
              <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                    <Wifi className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">Select network</h2>
                    <p className="text-xs text-muted-foreground">
                      MTN, Airtel, Glo, 9mobile, Smile, Spectranet & SME
                    </p>
                  </div>
                </div>
                <VtpassServicePicker
                  services={services}
                  value={serviceID}
                  onChange={setServiceID}
                  loading={loadingServices}
                  columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
                />
              </MotionSection>
            ) : (
              <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                    <Globe2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">International data</h2>
                    <p className="text-xs text-muted-foreground">
                      VTpass foreign-airtime · Mobile Data
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
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 sm:grid-cols-2">
                  {loadingIntl
                    ? null
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
                          <ServiceLogo src={op.operator_image} alt={op.name} />
                          <span className="text-sm font-semibold">{op.name}</span>
                        </button>
                      ))}
                </div>
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
                placeholder="0803 000 0000"
                className="h-12 w-full rounded-[14px] border border-border bg-background px-4 text-sm outline-none focus:border-primary"
              />
            </MotionSection>

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Data plans</h2>
                <div className="flex gap-1 overflow-x-auto">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      className={cn(
                        "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                        filter === f
                          ? "bg-primary text-white"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid max-h-[420px] gap-2 overflow-y-auto pr-1">
                {loadingPlans ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-[16px] bg-muted"
                    />
                  ))
                ) : filtered.length ? (
                  filtered.map((v) => (
                    <button
                      key={v.variationCode}
                      type="button"
                      onClick={() => setVariationCode(v.variationCode)}
                      className={cn(
                        "flex items-start justify-between gap-3 rounded-[16px] border px-4 py-3 text-left",
                        variationCode === v.variationCode
                          ? "border-primary bg-oryno-orange-muted"
                          : "border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{v.name}</p>
                        <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                          {inferDataPlanCategory(v.name)}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-primary">
                        {money(v.amount)}
                      </p>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No plans match this filter
                  </p>
                )}
              </div>
            </MotionSection>

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
                <Row label="Plan" value={selected?.name ?? "—"} />
                <Row label="Phone" value={phone || "—"} />
                <Row
                  label="Amount"
                  value={selected ? money(selected.amount) : money(0)}
                  accent
                />
                <div className="flex items-center gap-2 border-t border-border pt-3 font-semibold">
                  <Wallet className="h-4 w-4 text-primary" />
                  Pay from wallet
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
                : selected
                  ? `Buy data · ${money(selected.amount)}`
                  : "Select a plan"}
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
