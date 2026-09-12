"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Smartphone, Wallet } from "lucide-react";
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
import { airtimePresets, estimateAirtimeCashback } from "@/lib/telecom";
import { cleanNetworkName } from "@/lib/vtpass/catalog";
import {
  defaultIntlAirtimeAmount,
  intlAirtimeMinLocal,
  intlAirtimePresets,
} from "@/lib/vtpass/intl-airtime";
import { cn } from "@/lib/utils";
import { formatCountryMoney } from "@/lib/country";
import {
  CurrencyAmountInput,
  CurrencyPresetButton,
} from "@/components/app/currency-amount-input";

export default function AirtimePage() {
  const { country, loading: countryLoading, formatServiceMoney, displayFx } =
    useCountry();
  const { canAfford, canAffordNgn, frozen } = useWalletBalance();
  const countryCode = country?.code || "NG";
  const isNigeria = countryCode === "NG";
  const isInternational = !isNigeria;

  const [networks, setNetworks] = useState<VtpassServiceOption[]>([]);
  const [loadingNetworks, setLoadingNetworks] = useState(true);
  const [networkId, setNetworkId] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState(
    isNigeria ? "500" : defaultIntlAirtimeAmount(countryCode),
  );
  const [saveBeneficiary, setSaveBeneficiary] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState<string | null>(null);
  const [receiptAmount, setReceiptAmount] = useState("");
  const [productTypeId, setProductTypeId] = useState(1);

  const selectedNetwork = networks.find((n) => n.serviceID === networkId);

  const localAmount = Number(amount) || 0;
  const minLocal = isNigeria ? 50 : intlAirtimeMinLocal(countryCode);
  const amountNumber = isNigeria
    ? localAmount
    : localAmount * (displayFx?.localToNgn ?? 1);
  const cashback = estimateAirtimeCashback(amountNumber);

  const affordable = isNigeria
    ? canAfford(amountNumber)
    : canAffordNgn(amountNumber);
  const canSubmit = useMemo(() => {
    const digits = phone.replace(/\D/g, "").length >= 10;
    if (!digits || submitting || !networkId || frozen || !affordable) return false;
    return localAmount >= minLocal;
  }, [
    phone,
    submitting,
    networkId,
    localAmount,
    minLocal,
    frozen,
    affordable,
  ]);

  useEffect(() => {
    if (countryLoading) return;
    setAmount(isNigeria ? "500" : defaultIntlAirtimeAmount(countryCode));
  }, [countryLoading, isNigeria, countryCode]);

  // Load networks: NG = local VTU; elsewhere = operators for user country
  useEffect(() => {
    if (countryLoading) return;
    let cancelled = false;

    (async () => {
      setLoadingNetworks(true);
      setError(null);
      setNetworks([]);
      setNetworkId("");

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        "/api/vtpass/purchase/airtime",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isNigeria
              ? {
                  mode: "local",
                  serviceID: networkId,
                  phone,
                  amount: localAmount,
                  saveBeneficiary,
                }
              : {
                  mode: "international",
                  phone,
                  amount: localAmount,
                  operatorId: networkId,
                  countryIso: countryCode,
                  productTypeId,
                  saveBeneficiary,
                  flexibleLocalAmount: true,
                },
          ),
        },
      );
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
  const amountLabel = isInternational
    ? formatCountryMoney(localAmount, countryCode)
    : money(amountNumber);
  const amountPresets = isInternational
    ? intlAirtimePresets(countryCode)
    : airtimePresets;
  const currencyPrefix = country?.currencySymbol ?? "₦";

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

            <MotionSection
              delay={0.08}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <label className="mb-2 block text-sm font-medium">Amount</label>
              <CurrencyAmountInput
                prefix={currencyPrefix}
                value={amount}
                onChange={setAmount}
                min={minLocal}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {amountPresets.map((preset) => (
                  <CurrencyPresetButton
                    key={preset}
                    prefix={currencyPrefix}
                    amount={preset}
                    active={amount === preset}
                    onClick={() => setAmount(preset)}
                  />
                ))}
              </div>
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gift className="h-3.5 w-3.5 text-primary" />
                Est. cashback {money(cashback)}
              </p>
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-2xl border border-border bg-background p-4 shadow-[var(--shadow-soft)] sm:rounded-[28px] sm:p-6"
            >
              <h2 className="text-base font-semibold">Order summary</h2>
              <div className="mt-3 space-y-2 text-sm">
                <Row label="Network" value={selectedNetwork?.name ?? "—"} />
                <Row label="Phone" value={phone || "—"} />
                <Row label="Amount" value={amountLabel} accent />
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
                : frozen
                  ? "Wallet unavailable"
                  : !affordable && amountNumber > 0
                    ? "Insufficient balance"
                    : `Buy airtime · ${amountLabel}`}
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
