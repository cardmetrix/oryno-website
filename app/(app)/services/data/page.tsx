"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Wallet, Wifi } from "lucide-react";
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
import { useCountry } from "@/components/providers/country-provider";
import { formatCountryMoney } from "@/lib/country";
import { cleanNetworkName, inferDataPlanCategory } from "@/lib/vtpass/catalog";
import { cn } from "@/lib/utils";

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const FILTERS = ["All", "Daily", "Weekly", "Monthly"] as const;

export default function DataPage() {
  const { country, loading: countryLoading } = useCountry();
  const countryCode = country?.code || "NG";
  const isNigeria = countryCode === "NG";

  const [networks, setNetworks] = useState<VtpassServiceOption[]>([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [networkId, setNetworkId] = useState("");
  const [phone, setPhone] = useState("");
  const [variations, setVariations] = useState<Variation[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [variationCode, setVariationCode] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState("");
  const [productTypeId, setProductTypeId] = useState(4);

  const selected = variations.find((v) => v.variationCode === variationCode);
  const selectedNetwork = networks.find((n) => n.serviceID === networkId);

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
    return Boolean(networkId);
  }, [phone, selected, submitting, networkId]);

  useEffect(() => {
    if (countryLoading) return;
    let cancelled = false;

    (async () => {
      setLoadingNetworks(true);
      setError(null);
      setNetworks([]);
      setNetworkId("");
      setVariations([]);
      setVariationCode("");

      try {
        if (isNigeria) {
          const res = await fetch("/api/vtpass/services?identifier=data");
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to load networks");
          if (cancelled) return;
          const list: VtpassServiceOption[] = data.services ?? [];
          setNetworks(list);
          if (list[0]?.serviceID) setNetworkId(list[0].serviceID);
        } else {
          const typesRes = await fetch(
            `/api/vtpass/international/product-types?code=${encodeURIComponent(countryCode)}`,
          );
          const typesData = await typesRes.json();
          if (!typesRes.ok) throw new Error(typesData.error);
          const dataType =
            (
              typesData.productTypes as {
                product_type_id: number;
                name: string;
              }[]
            )?.find((t) => /data/i.test(t.name)) ||
            typesData.productTypes?.[0];
          if (!dataType) throw new Error("No data products for your country");
          setProductTypeId(dataType.product_type_id);

          const opRes = await fetch(
            `/api/vtpass/international/operators?code=${encodeURIComponent(countryCode)}&product_type_id=${dataType.product_type_id}`,
          );
          const opData = await opRes.json();
          if (!opRes.ok) throw new Error(opData.error);
          if (cancelled) return;

          const list: VtpassServiceOption[] = (
            opData.operators as {
              operator_id: string;
              name: string;
              operator_image?: string;
            }[]
          ).map((op) => ({
            serviceID: String(op.operator_id),
            name: cleanNetworkName(op.name),
            image: op.operator_image ?? null,
          }));
          setNetworks(list);
          if (list[0]?.serviceID) setNetworkId(list[0].serviceID);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load networks");
        }
      } finally {
        if (!cancelled) setLoadingNetworks(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [countryLoading, isNigeria, countryCode]);

  useEffect(() => {
    if (!networkId) return;
    let cancelled = false;

    (async () => {
      setLoadingPlans(true);
      setVariationCode("");
      try {
        const url = isNigeria
          ? `/api/vtpass/variations?serviceID=${encodeURIComponent(networkId)}`
          : `/api/vtpass/variations?serviceID=foreign-airtime&operator_id=${encodeURIComponent(networkId)}&product_type_id=${productTypeId}`;
        const res = await fetch(url);
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
  }, [isNigeria, networkId, productTypeId]);

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
                serviceID: networkId,
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
                operatorId: networkId,
                countryIso: countryCode,
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

  const money = (n: number) => formatCountryMoney(n, countryCode);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Buy Data"
        subtitle="Daily, weekly & monthly plans"
        backHref="/dashboard"
      />

      <AnimatePresence mode="wait">
        {success && selected ? (
          <MotionSection key="success">
            <ServiceSuccess
              title="Data sent!"
              subtitle={`${selected.name} delivered to ${phone}`}
              amountLabel="Amount charged"
              amount={receipt || money(selected.amount)}
              secondaryAction={{
                label: "Back to Home",
                href: "/dashboard",
                icon: "home",
              }}
              tertiaryAction={{
                label: "Buy again",
                onClick: () => setSuccess(false),
                icon: "plus",
              }}
            />
          </MotionSection>
        ) : (
          <form
            key="form"
            onSubmit={onSubmit}
            className="space-y-4 sm:space-y-5"
          >
            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <Wifi className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold">Select network</h2>
                  <p className="text-xs text-muted-foreground">
                    Networks for {country?.name || "your country"}
                  </p>
                </div>
              </div>
              <VtpassServicePicker
                services={networks}
                value={networkId}
                onChange={setNetworkId}
                loading={loadingNetworks || countryLoading}
                columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"
              />
            </MotionSection>

            <MotionSection
              delay={0.05}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="mb-2 block text-sm font-medium">
                Phone number
              </label>
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
                <Row label="Network" value={selectedNetwork?.name ?? "—"} />
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

            <ServiceInstructions service="data" delay={0.12} />

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

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Buy Data"
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
