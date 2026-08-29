"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Gift, Smartphone, Wallet } from "lucide-react";
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
import { airtimePresets, estimateAirtimeCashback } from "@/lib/telecom";
import { cleanNetworkName } from "@/lib/vtpass/catalog";
import { cn } from "@/lib/utils";

type Variation = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

export default function AirtimePage() {
  const { country, loading: countryLoading, formatServiceMoney } = useCountry();
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
      const res = await fetch(
        isNigeria ? "/api/sogo/bills/airtime" : "/api/vtpass/purchase/airtime",
        {
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

  const money = (n: number) => formatServiceMoney(n);

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
            <ServiceSuccess
              title="Airtime sent!"
              subtitle={`${receiptAmount || money(amountNumber)} sent to ${phone}${selectedNetwork ? ` · ${selectedNetwork.name}` : ""}`}
              amountLabel="Amount charged"
              amount={receiptAmount || money(amountNumber)}
              onDismiss={() => setSuccess(false)}
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
            >
              {isNigeria || walletLabel ? (
                <div className="space-y-1 text-center text-sm">
                  {isNigeria ? (
                    <p className="font-semibold text-primary">
                      Cashback: {money(cashback)}
                    </p>
                  ) : null}
                  {walletLabel ? (
                    <p className="text-xs text-muted-foreground">
                      Wallet balance {walletLabel}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </ServiceSuccess>
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
              <div className="md:hidden">
                <SelectSheet
                  label="Network"
                  title="Select network"
                  subtitle={`Networks for ${country?.name || "your country"}`}
                  hint="Tap to choose a network"
                  value={networkId}
                  valueLabel={selectedNetwork?.name}
                  valueImage={selectedNetwork?.image}
                  onChange={setNetworkId}
                  loading={loadingNetworks || countryLoading}
                  emptyText="No networks available"
                  options={networks.map((n) => ({
                    id: n.serviceID,
                    title: n.name,
                    image: n.image ?? null,
                    subtitle: "Tap to select",
                  }))}
                />
              </div>
              <div className="hidden md:block">
                <VtpassServicePicker
                  services={networks}
                  value={networkId}
                  onChange={setNetworkId}
                  loading={loadingNetworks || countryLoading}
                />
              </div>
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
                <SelectSheet
                  label="Package"
                  title="Select package"
                  subtitle="Airtime top-up packages"
                  hint="Tap to choose a package"
                  value={variationCode}
                  valueLabel={selectedVariation?.name}
                  onChange={setVariationCode}
                  loading={loadingPackages}
                  emptyText="No packages for this network"
                  options={variations.map((v) => ({
                    id: v.variationCode,
                    title: v.name,
                    trailing: money(v.amount),
                  }))}
                />
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
