"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Wallet } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { ServiceSuccess } from "@/components/app/service-success";
import { ErrorAlertModal } from "@/components/app/error-alert-modal";
import { TelecomNetworkGrid } from "@/components/app/telecom-network-grid";
import { PhoneNumberField } from "@/components/app/phone-number-field";
import type { VtpassServiceOption } from "@/components/app/vtpass-service-picker";
import { useCountry } from "@/components/providers/country-provider";
import { useWalletBalance } from "@/hooks/use-wallet-balance";
import { useInvalidateWallet } from "@/hooks/use-wallet";
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
} from "@/components/app/currency-amount-input";

export default function AirtimePage() {
  const { country, loading: countryLoading, formatServiceMoney, displayFx } =
    useCountry();
  const { canAfford, canAffordNgn, frozen } = useWalletBalance();
  const invalidateWallet = useInvalidateWallet();
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
  const [retailCharge, setRetailCharge] = useState(0);

  const selectedNetwork = networks.find((n) => n.serviceID === networkId);

  const localAmount = Number(amount) || 0;
  const minLocal = isNigeria ? 50 : intlAirtimeMinLocal(countryCode);
  const amountNumber = isNigeria
    ? localAmount
    : localAmount * (displayFx?.localToNgn ?? 1);
  /** Wallet debit amount (includes markup for Nigeria). */
  const chargeAmount =
    isNigeria && retailCharge > 0 ? retailCharge : amountNumber;
  const cashback = estimateAirtimeCashback(amountNumber);

  const affordable = isNigeria
    ? canAfford(chargeAmount)
    : canAffordNgn(chargeAmount);
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

  useEffect(() => {
    if (!isNigeria || !networkId || localAmount < minLocal) {
      setRetailCharge(0);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({
            serviceID: networkId,
            amount: String(localAmount),
          });
          const res = await fetch(`/api/vtpass/quote?${params}`, {
            cache: "no-store",
          });
          const json = (await res.json()) as { retail?: number };
          if (!cancelled && res.ok && typeof json.retail === "number") {
            setRetailCharge(json.retail);
          }
        } catch {
          if (!cancelled) setRetailCharge(0);
        }
      })();
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isNigeria, networkId, localAmount, minLocal]);

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
      const res = await fetch("/api/vtpass/purchase/airtime", {
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
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setReceiptAmount(data.amountFormatted);
      setWalletLabel(data.wallet?.balanceFormatted ?? null);
      setSuccess(true);
      void invalidateWallet();
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
      <PageHeader title="Buy Airtime" backHref="/dashboard" />

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
            className="space-y-6 pb-8 sm:space-y-7"
          >
            <MotionSection className="space-y-3">
              <h2 className="text-[15px] font-bold text-foreground">
                Select Network
              </h2>
              <TelecomNetworkGrid
                services={networks}
                value={networkId}
                onChange={setNetworkId}
                loading={loadingNetworks || countryLoading}
              />
            </MotionSection>

            <MotionSection delay={0.04} className="space-y-3">
              <PhoneNumberField
                value={phone}
                onChange={setPhone}
                placeholder={isNigeria ? "0803 000 0000" : "Recipient number"}
              />
              <label className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveBeneficiary}
                  onChange={(e) => setSaveBeneficiary(e.target.checked)}
                  className="rounded border-border"
                />
                Save as beneficiary
              </label>
            </MotionSection>

            <MotionSection delay={0.08} className="space-y-3">
              <h2 className="text-[15px] font-bold text-foreground">
                Select Amount
              </h2>
              <CurrencyAmountInput
                prefix={currencyPrefix}
                value={amount}
                onChange={setAmount}
                min={minLocal}
                className="h-14 rounded-2xl border-0 bg-muted focus-within:border-0 focus-within:ring-2 focus-within:ring-primary/25"
                inputClassName="text-[15px] font-medium"
              />
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
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
                        {currencyPrefix}
                        {Number(preset).toLocaleString()}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
                <Gift className="h-3.5 w-3.5 text-primary" />
                Est. cashback {money(cashback)}
              </p>
            </MotionSection>

            <MotionSection
              delay={0.1}
              className="rounded-2xl bg-muted/70 px-4 py-4"
            >
              <div className="space-y-2 text-sm">
                <Row label="Network" value={selectedNetwork?.name ?? "—"} />
                <Row label="Phone" value={phone || "—"} />
                <Row label="Airtime value" value={amountLabel} />
                {isNigeria && retailCharge > 0 && retailCharge !== localAmount ? (
                  <Row
                    label="You pay"
                    value={money(retailCharge)}
                    accent
                  />
                ) : (
                  <Row label="Amount" value={amountLabel} accent />
                )}
                <div className="flex items-center justify-between border-t border-border/70 pt-3">
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
                  : !affordable && chargeAmount > 0
                    ? "Insufficient balance"
                    : `Buy airtime · ${
                        isNigeria && retailCharge > 0
                          ? money(retailCharge)
                          : amountLabel
                      }`}
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
