"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Gift, Smartphone, Wallet } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { ServiceInstructions } from "@/components/app/service-instructions";
import {
  VtpassServicePicker,
  type VtpassServiceOption,
} from "@/components/app/vtpass-service-picker";
import { useCountry } from "@/components/providers/country-provider";
import { airtimePresets, estimateAirtimeCashback } from "@/lib/telecom";
import { formatCountryMoney } from "@/lib/country";
import { cleanNetworkName } from "@/lib/vtpass/catalog";
import { cn } from "@/lib/utils";

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

export default function AirtimePage() {
  const { country, loading: countryLoading } = useCountry();
  const countryCode = country?.code || "NG";
  const isNigeria = countryCode === "NG";

  const [networks, setNetworks] = useState<VtpassServiceOption[]>([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [networkId, setNetworkId] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("500");
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState("");

  // Non-NG: package variations from foreign-airtime
  const [variations, setVariations] = useState<Variation[]>([]);
  const [variationCode, setVariationCode] = useState("");
  const [productTypeId, setProductTypeId] = useState(1);
  const [loadingPackages, setLoadingPackages] = useState(false);

  const selectedNetwork = networks.find((n) => n.serviceID === networkId);
  const selectedVariation = variations.find(
    (v) => v.variationCode === variationCode,
  );

  const amountNumber = isNigeria
    ? Number(amount) || 0
    : selectedVariation?.amount || 0;
  const cashback = estimateAirtimeCashback(amountNumber);

  const canSubmit = useMemo(() => {
    const digits = phone.replace(/\D/g, "").length >= 10;
    if (!digits || submitting || !networkId) return false;
    if (isNigeria) return amountNumber >= 50;
    return Boolean(variationCode && amountNumber > 0);
  }, [
    phone,
    submitting,
    networkId,
    isNigeria,
    amountNumber,
    variationCode,
  ]);

  // Load networks: NG = local VTU; elsewhere = operators for user country
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
          const res = await fetch("/api/vtpass/services?identifier=airtime");
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
          if (!typesRes.ok) {
            throw new Error(typesData.error || "Failed to load networks");
          }
          const topUp =
            (
              typesData.productTypes as {
                product_type_id: number;
                name: string;
              }[]
            )?.find((t) => /top\s*up|airtime/i.test(t.name)) ||
            typesData.productTypes?.[0];
          if (!topUp) throw new Error("No airtime products for your country");

          setProductTypeId(topUp.product_type_id);

          const opRes = await fetch(
            `/api/vtpass/international/operators?code=${encodeURIComponent(countryCode)}&product_type_id=${topUp.product_type_id}`,
          );
          const opData = await opRes.json();
          if (!opRes.ok) {
            throw new Error(opData.error || "Failed to load networks");
          }
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

  // Non-NG packages for selected operator
  useEffect(() => {
    if (isNigeria || !networkId) return;
    let cancelled = false;

    (async () => {
      setLoadingPackages(true);
      setVariationCode("");
      try {
        const res = await fetch(
          `/api/vtpass/variations?serviceID=foreign-airtime&operator_id=${encodeURIComponent(networkId)}&product_type_id=${productTypeId}`,
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
      } finally {
        if (!cancelled) setLoadingPackages(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isNigeria, networkId, productTypeId]);

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
                serviceID: networkId,
                phone,
                amount: amountNumber,
                saveBeneficiary,
              }
            : {
                mode: "international",
                phone,
                amount: amountNumber,
                operatorId: networkId,
                countryIso: countryCode,
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

  const money = (n: number) => formatCountryMoney(n, countryCode);

  return (
    <AppShell hideNav>
      <PageHeader
        title="Buy Airtime"
        subtitle="Top up any network instantly"
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
                {selectedNetwork ? ` · ${selectedNetwork.name}` : ""}
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
          <form
            key="form"
            onSubmit={onSubmit}
            className="space-y-4 sm:space-y-5"
          >
            <MotionSection className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-oryno-orange-muted text-primary">
                  <Smartphone className="h-5 w-5" />
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
                <h2 className="mb-3 text-base font-semibold">Select package</h2>
                <div className="grid gap-2">
                  {loadingPackages
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-14 animate-pulse rounded-[16px] bg-muted"
                        />
                      ))
                    : variations.map((v) => (
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
                  {!loadingPackages && !variations.length ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No packages for this network
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
                <Row label="Network" value={selectedNetwork?.name ?? "—"} />
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

            <ServiceInstructions service="airtime" delay={0.12} />

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

      <ErrorAlertModal
        error={error}
        onClose={() => setError(null)}
        page="Buy Airtime"
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
