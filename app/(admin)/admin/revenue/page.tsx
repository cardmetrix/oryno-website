"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatCard } from "@/components/admin/stat-card";
import type { CompanyChargesConfig } from "@/lib/company/charge-types";
import { VIRTUAL_NUMBER_COUNTRY_OPTIONS } from "@/lib/company/charge-types";

type SourceRow = {
  id: keyof CompanyChargesConfig["services"];
  label: string;
  silent: boolean;
};

type FxRateRow = {
  currency: string;
  countryCode: string;
  countryName: string;
  symbol: string;
  midRate: number;
  provider: string;
  buyRate: number | null;
  sellRate: number | null;
  spreadPercent: number | null;
  customerBuy: number;
  customerSell: number;
  profitPerUsdBuy: number;
  profitPerUsdSell: number;
};

type Summary = {
  balances: Array<{
    currency: string;
    available: number;
    lifetimeRecognized: number;
    lifetimeWithdrawn: number;
  }>;
  last30d: { profitNgn: number; count: number };
  bySource: Array<{
    source: string;
    currency: string;
    profit: number;
    profitNgn: number;
    count: number;
  }>;
  recent: Array<{
    id: string;
    source: string;
    status: string;
    currency: string;
    grossIn: number;
    grossOut: number;
    profitAmount: number;
    profitNgn: number;
    chargeAmount: number;
    fxSpreadAmount: number;
    description: string | null;
    createdAt: string;
  }>;
  payouts: Array<{
    id: string;
    currency: string;
    amount: number;
    status: string;
    destinationLabel: string | null;
    createdAt: string;
  }>;
};

type RevenueResponse = {
  ok: true;
  config: CompanyChargesConfig;
  sources: SourceRow[];
  fxRates: FxRateRow[];
  summary: Summary;
};

function money(n: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<RevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyChargesConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [countryToAdd, setCountryToAdd] = useState(
    VIRTUAL_NUMBER_COUNTRY_OPTIONS[0]?.slug || "nigeria",
  );
  const [customCountrySlug, setCustomCountrySlug] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutCurrency, setPayoutCurrency] = useState("NGN");
  const [payoutLabel, setPayoutLabel] = useState("ORYNO business account");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [sendViaGateway, setSendViaGateway] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue", { cache: "no-store" });
      const json = (await res.json()) as RevenueResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load revenue");
      setData(json);
      setDraft(json.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load revenue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ngnBalance = data?.summary.balances.find((b) => b.currency === "NGN");
  const usdBalance = data?.summary.balances.find((b) => b.currency === "USD");

  const sourceLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data?.sources ?? []) map.set(row.id, row.label);
    return map;
  }, [data?.sources]);

  async function saveCharges() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_charges", config: draft }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast.success("Company charges and conversion rates saved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function submitPayout() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/revenue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "payout",
          payout: {
            currency: payoutCurrency,
            amount: Number(payoutAmount),
            destinationLabel: payoutLabel,
            bankName,
            accountName,
            accountNumber,
            bankCode,
            notes: payoutNotes,
            sendViaGateway,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Payout failed");
      toast.success(
        sendViaGateway
          ? "Profit payout sent via Flutterwave"
          : "Profit withdrawal recorded on the company ledger",
      );
      setPayoutAmount("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Payout failed");
    } finally {
      setSaving(false);
    }
  }

  function setService(
    id: SourceRow["id"],
    patch: Partial<CompanyChargesConfig["services"][SourceRow["id"]]>,
  ) {
    if (!draft) return;
    setDraft({
      ...draft,
      services: {
        ...draft.services,
        [id]: { ...draft.services[id], ...patch },
      },
      withdrawFeeNgn:
        id === "withdraw" && patch.value != null
          ? Number(patch.value)
          : draft.withdrawFeeNgn,
      virtualNumberByCountry: draft.virtualNumberByCountry ?? {},
    });
  }

  function setVnCountry(
    slug: string,
    patch: Partial<NonNullable<CompanyChargesConfig["virtualNumberByCountry"]>[string]>,
  ) {
    if (!draft) return;
    const key = slug.trim().toLowerCase();
    if (!key) return;
    const current = draft.virtualNumberByCountry?.[key] ?? {
      mode: "percent" as const,
      value: 0,
      enabled: true,
      label: key,
    };
    setDraft({
      ...draft,
      virtualNumberByCountry: {
        ...(draft.virtualNumberByCountry ?? {}),
        [key]: { ...current, ...patch },
      },
    });
  }

  function addVnCountry() {
    if (!draft) return;
    const custom = customCountrySlug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const slug = custom || countryToAdd;
    if (!slug) return;
    if (draft.virtualNumberByCountry?.[slug]) {
      toast.error("That country is already in the list");
      return;
    }
    const known = VIRTUAL_NUMBER_COUNTRY_OPTIONS.find((c) => c.slug === slug);
    const overall = draft.services.virtual_number;
    setDraft({
      ...draft,
      virtualNumberByCountry: {
        ...(draft.virtualNumberByCountry ?? {}),
        [slug]: {
          mode: overall.mode === "percent" ? "percent" : "percent",
          value: overall.mode === "percent" ? overall.value : 0,
          enabled: true,
          label: known?.label || slug,
        },
      },
    });
    setCustomCountrySlug("");
    toast.success(`Added ${known?.label || slug}`);
  }

  function removeVnCountry(slug: string) {
    if (!draft) return;
    const next = { ...(draft.virtualNumberByCountry ?? {}) };
    delete next[slug];
    setDraft({ ...draft, virtualNumberByCountry: next });
  }

  function setFxCurrency(
    currency: string,
    patch: Partial<CompanyChargesConfig["fx"]["currencies"][string]>,
  ) {
    if (!draft) return;
    const current = draft.fx.currencies[currency] ?? {
      buyRate: null,
      sellRate: null,
      spreadPercent: null,
    };
    setDraft({
      ...draft,
      fx: {
        ...draft.fx,
        currencies: {
          ...draft.fx.currencies,
          [currency]: { ...current, ...patch },
        },
      },
    });
  }

  return (
    <>
      <AdminPageHeader
        title="Revenue"
        subtitle="Company charges, conversion rates, and profit held separately from customer wallets"
      />

      {loading ? <AdminLoadingBlock variant="reports" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={load} /> : null}

      {data && draft ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Company NGN available"
              value={money(ngnBalance?.available ?? 0, "NGN")}
              change="Recognized profit not yet withdrawn"
              up
            />
            <StatCard
              label="Company USD available"
              value={money(usdBalance?.available ?? 0, "USD")}
              change="USD-wallet service margin"
              up
              delay={0.05}
            />
            <StatCard
              label="Profit last 30 days"
              value={money(data.summary.last30d.profitNgn, "NGN")}
              change={`${data.summary.last30d.count} settled trades`}
              up
              delay={0.1}
            />
            <StatCard
              label="Lifetime NGN recognized"
              value={money(ngnBalance?.lifetimeRecognized ?? 0, "NGN")}
              change={`${money(ngnBalance?.lifetimeWithdrawn ?? 0, "NGN")} withdrawn`}
              delay={0.15}
            />
          </div>

          <AdminCard title="Company charges" delay={0.05} className="mb-5">
            <p className="mb-4 text-sm text-muted-foreground">
              These amounts are added to the customer total with no “service
              charge” label, except withdrawals, which always show the ₦ fee.
              Flat charges are in Naira and converted for other countries.
              For virtual numbers you can set an overall percent, then override
              individual destination countries.
            </p>
            <div className="space-y-3">
              {data.sources.map((source) => {
                const charge = draft.services[source.id];
                const isVirtualNumber = source.id === "virtual_number";
                const vnCountries = Object.entries(
                  draft.virtualNumberByCountry ?? {},
                ).sort(([a], [b]) => a.localeCompare(b));
                const availableCountries = VIRTUAL_NUMBER_COUNTRY_OPTIONS.filter(
                  (c) => !draft.virtualNumberByCountry?.[c.slug],
                );

                return (
                  <div
                    key={source.id}
                    className="rounded-[16px] border border-border px-4 py-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-12 sm:items-center">
                      <div className="sm:col-span-4">
                        <p className="text-sm font-semibold text-foreground">
                          {source.label}
                          {isVirtualNumber ? " · overall" : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isVirtualNumber
                            ? "Default for all countries unless a country override is enabled"
                            : source.silent
                              ? "Silent — baked into the price the customer sees"
                              : "Shown on the withdrawal screen"}
                        </p>
                      </div>
                      <label className="sm:col-span-2">
                        <span className="sr-only">Mode</span>
                        <select
                          value={source.id === "withdraw" ? "flat" : charge.mode}
                          disabled={source.id === "withdraw"}
                          onChange={(e) =>
                            setService(source.id, {
                              mode: e.target.value as "flat" | "percent",
                            })
                          }
                          className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm"
                        >
                          <option value="flat">Flat ₦</option>
                          <option value="percent">Percent</option>
                        </select>
                      </label>
                      <label className="sm:col-span-3">
                        <span className="sr-only">Value</span>
                        <input
                          inputMode="decimal"
                          value={
                            source.id === "withdraw"
                              ? String(draft.withdrawFeeNgn)
                              : String(charge.value)
                          }
                          onChange={(e) => {
                            const value = Number(e.target.value);
                            if (source.id === "withdraw") {
                              setDraft({
                                ...draft,
                                withdrawFeeNgn: value,
                                services: {
                                  ...draft.services,
                                  withdraw: {
                                    ...draft.services.withdraw,
                                    value,
                                  },
                                },
                                virtualNumberByCountry:
                                  draft.virtualNumberByCountry ?? {},
                              });
                              return;
                            }
                            setService(source.id, { value });
                          }}
                          className="h-10 w-full rounded-[12px] border border-border bg-background px-3 text-sm"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm sm:col-span-3">
                        <input
                          type="checkbox"
                          checked={charge.enabled}
                          onChange={(e) =>
                            setService(source.id, {
                              enabled: e.target.checked,
                            })
                          }
                          className="h-4 w-4 accent-primary"
                        />
                        Enabled
                      </label>
                    </div>

                    {isVirtualNumber ? (
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              Per-country revenue
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Enabled country rows override the overall virtual
                              number charge for that destination.
                            </p>
                          </div>
                          <div className="flex flex-wrap items-end gap-2">
                            <label className="text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Country
                              </span>
                              <select
                                value={countryToAdd}
                                onChange={(e) => setCountryToAdd(e.target.value)}
                                className="h-10 min-w-[160px] rounded-[12px] border border-border bg-background px-3 text-sm"
                              >
                                {availableCountries.map((c) => (
                                  <option key={c.slug} value={c.slug}>
                                    {c.label}
                                  </option>
                                ))}
                                {availableCountries.length === 0 ? (
                                  <option value="">All listed</option>
                                ) : null}
                              </select>
                            </label>
                            <label className="text-xs">
                              <span className="mb-1 block text-muted-foreground">
                                Or custom slug
                              </span>
                              <input
                                value={customCountrySlug}
                                onChange={(e) =>
                                  setCustomCountrySlug(e.target.value)
                                }
                                placeholder="e.g. netherlands"
                                className="h-10 w-40 rounded-[12px] border border-border bg-background px-3 text-sm"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={addVnCountry}
                              className="h-10 rounded-[12px] bg-primary px-4 text-sm font-semibold text-primary-foreground"
                            >
                              Add country
                            </button>
                          </div>
                        </div>

                        {vnCountries.length === 0 ? (
                          <p className="rounded-[12px] bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                            No country overrides yet — overall percent applies
                            to every destination.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {vnCountries.map(([slug, row]) => (
                              <div
                                key={slug}
                                className="grid gap-2 rounded-[12px] border border-border/80 bg-muted/20 px-3 py-2.5 sm:grid-cols-12 sm:items-center"
                              >
                                <div className="sm:col-span-3">
                                  <p className="text-sm font-semibold text-foreground">
                                    {row.label || slug}
                                  </p>
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    {slug}
                                  </p>
                                </div>
                                <label className="sm:col-span-2">
                                  <select
                                    value={row.mode}
                                    onChange={(e) =>
                                      setVnCountry(slug, {
                                        mode: e.target.value as
                                          | "flat"
                                          | "percent",
                                      })
                                    }
                                    className="h-9 w-full rounded-[10px] border border-border bg-background px-2 text-sm"
                                  >
                                    <option value="flat">Flat ₦</option>
                                    <option value="percent">Percent</option>
                                  </select>
                                </label>
                                <label className="sm:col-span-3">
                                  <input
                                    inputMode="decimal"
                                    value={String(row.value)}
                                    onChange={(e) =>
                                      setVnCountry(slug, {
                                        value: Number(e.target.value),
                                      })
                                    }
                                    className="h-9 w-full rounded-[10px] border border-border bg-background px-2 text-sm"
                                  />
                                </label>
                                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                                  <input
                                    type="checkbox"
                                    checked={row.enabled}
                                    onChange={(e) =>
                                      setVnCountry(slug, {
                                        enabled: e.target.checked,
                                      })
                                    }
                                    className="h-4 w-4 accent-primary"
                                  />
                                  On
                                </label>
                                <button
                                  type="button"
                                  onClick={() => removeVnCountry(slug)}
                                  className="h-9 rounded-[10px] border border-border px-2 text-xs font-semibold text-destructive sm:col-span-2"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </AdminCard>

          <AdminCard title="Conversion rates by country" delay={0.08} className="mb-5">
            <p className="mb-4 text-sm text-muted-foreground">
              Live mid-market is what $1 is actually worth. Customer buy is what
              users pay per $1. The difference is ORYNO conversion profit.
              Leave buy/sell empty to use the default spread.
            </p>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-muted-foreground">
                  Default spread %
                </span>
                <input
                  inputMode="decimal"
                  value={String(draft.fx.defaultSpreadPercent)}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      fx: {
                        ...draft.fx,
                        defaultSpreadPercent: Number(e.target.value),
                      },
                    })
                  }
                  className="h-10 w-28 rounded-[12px] border border-border bg-background px-3 text-sm"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Country</th>
                    <th className="pb-2 pr-3 font-medium">Live mid / $1</th>
                    <th className="pb-2 pr-3 font-medium">Customer buy</th>
                    <th className="pb-2 pr-3 font-medium">Customer sell</th>
                    <th className="pb-2 pr-3 font-medium">Spread %</th>
                    <th className="pb-2 font-medium">Profit / $1 buy</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fxRates.map((row) => {
                    const override = draft.fx.currencies[row.currency] ?? {
                      buyRate: null,
                      sellRate: null,
                      spreadPercent: null,
                    };
                    return (
                      <tr key={row.currency} className="border-t border-border">
                        <td className="py-2.5 pr-3">
                          <p className="font-semibold text-foreground">
                            {row.countryName} · {row.currency}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.symbol} · {row.provider}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3 font-medium">
                          {row.midRate ? row.midRate.toFixed(4) : "—"}
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            inputMode="decimal"
                            placeholder={row.customerBuy.toFixed(2)}
                            value={override.buyRate ?? ""}
                            onChange={(e) =>
                              setFxCurrency(row.currency, {
                                buyRate: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="h-9 w-28 rounded-[10px] border border-border bg-background px-2 text-sm"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            inputMode="decimal"
                            placeholder={row.customerSell.toFixed(2)}
                            value={override.sellRate ?? ""}
                            onChange={(e) =>
                              setFxCurrency(row.currency, {
                                sellRate: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="h-9 w-28 rounded-[10px] border border-border bg-background px-2 text-sm"
                          />
                        </td>
                        <td className="py-2.5 pr-3">
                          <input
                            inputMode="decimal"
                            placeholder={String(draft.fx.defaultSpreadPercent)}
                            value={override.spreadPercent ?? ""}
                            onChange={(e) =>
                              setFxCurrency(row.currency, {
                                spreadPercent: e.target.value
                                  ? Number(e.target.value)
                                  : null,
                              })
                            }
                            className="h-9 w-20 rounded-[10px] border border-border bg-background px-2 text-sm"
                          />
                        </td>
                        <td className="py-2.5 font-semibold text-foreground">
                          {money(row.profitPerUsdBuy, row.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveCharges()}
              className="btn-primary mt-4 h-11 px-5 text-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save charges & rates"}
            </button>
          </AdminCard>

          <div className="mb-5 grid gap-5 lg:grid-cols-2">
            <AdminCard title="Profit by service" delay={0.1}>
              {data.summary.bySource.length === 0 ? (
                <AdminEmptyBlock message="No recognized company profit yet." />
              ) : (
                <AdminTable
                  rows={data.summary.bySource.map((row, i) => ({
                    ...row,
                    id: `${row.source}-${row.currency}-${i}`,
                  }))}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "source",
                      header: "Service",
                      cell: (row) =>
                        sourceLabels.get(row.source) || row.source,
                    },
                    {
                      key: "profit",
                      header: "Profit",
                      cell: (row) => money(row.profit, row.currency),
                    },
                    {
                      key: "count",
                      header: "Trades",
                      cell: (row) => String(row.count),
                    },
                  ]}
                />
              )}
            </AdminCard>

            <AdminCard title="Withdraw company profit" delay={0.12}>
              <p className="mb-4 text-sm text-muted-foreground">
                This deducts the company ledger only. Cash still sits in
                Flutterwave / provider wallets until you move it. Record a
                withdrawal after you take funds from those dashboards, or send
                via Flutterwave to the business bank.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Currency
                  </span>
                  <select
                    value={payoutCurrency}
                    onChange={(e) => setPayoutCurrency(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  >
                    <option value="NGN">NGN</option>
                    <option value="USD">USD</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Amount
                  </span>
                  <input
                    inputMode="decimal"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">
                    Destination
                  </span>
                  <input
                    value={payoutLabel}
                    onChange={(e) => setPayoutLabel(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">Bank</span>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Bank code
                  </span>
                  <input
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Account name
                  </span>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    Account number
                  </span>
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-muted-foreground">Notes</span>
                  <input
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    className="h-10 w-full rounded-[12px] border border-border bg-background px-3"
                  />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={sendViaGateway}
                  onChange={(e) => setSendViaGateway(e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Send via Flutterwave (uses the same merchant balance as customer payouts)
              </label>
              <button
                type="button"
                disabled={saving || !Number(payoutAmount)}
                onClick={() => void submitPayout()}
                className="btn-primary mt-4 h-11 px-5 text-sm disabled:opacity-50"
              >
                {sendViaGateway ? "Send profit payout" : "Record profit withdrawal"}
              </button>
              {data.summary.payouts.length > 0 ? (
                <div className="mt-5">
                  <AdminTable
                    rows={data.summary.payouts}
                    rowKey={(row) => row.id}
                    columns={[
                      {
                        key: "amount",
                        header: "Payout",
                        cell: (row) => money(row.amount, row.currency),
                      },
                      {
                        key: "status",
                        header: "Status",
                        cell: (row) => row.status,
                      },
                      {
                        key: "dest",
                        header: "To",
                        cell: (row) => row.destinationLabel || "—",
                      },
                    ]}
                  />
                </div>
              ) : null}
            </AdminCard>
          </div>

          <AdminCard title="Recent company profit entries" delay={0.14}>
            {data.summary.recent.length === 0 ? (
              <AdminEmptyBlock message="Profit entries appear here after a conversion, gift-card, number, boost, email, or withdrawal completes." />
            ) : (
              <AdminTable
                rows={data.summary.recent}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "source",
                    header: "Service",
                    cell: (row) => (
                      <div>
                        <p className="font-semibold">
                          {sourceLabels.get(row.source) || row.source}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {row.description}
                        </p>
                      </div>
                    ),
                  },
                  {
                    key: "in",
                    header: "In / Out",
                    cell: (row) =>
                      `${money(row.grossIn, row.currency)} → ${money(row.grossOut, row.currency)}`,
                  },
                  {
                    key: "profit",
                    header: "Profit",
                    cell: (row) => (
                      <span className="font-semibold">
                        {money(row.profitAmount, row.currency)}
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => row.status,
                  },
                ]}
              />
            )}
          </AdminCard>
        </>
      ) : null}
    </>
  );
}
