"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";

async function pricingFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json === "object" && json && "error" in json
        ? String((json as { error?: string }).error || "Request failed")
        : "Request failed",
    );
  }
  return json as T;
}

type ProviderKey = "jap" | "herosms" | "reloadly" | "sogo" | "vtpass";

type ProviderPricing = {
  markup: number;
  payoutShare?: number;
  enabled: boolean;
};

type PricingConfig = {
  fxCommission: number;
  providers: Record<ProviderKey, ProviderPricing>;
};

type OverrideRow = {
  id: string;
  provider: ProviderKey;
  serviceKey: string;
  label: string | null;
  mode: "markup" | "fixed" | "percent";
  value: number;
  active: boolean;
  updatedAt: string;
};

type PricingResponse = {
  ok: true;
  config: PricingConfig;
  overrides: OverrideRow[];
  providers: ProviderKey[];
};

type CatalogItem = {
  id?: string;
  serviceKey: string;
  title: string;
  subtitle: string;
  details: string;
  currency: string;
  costUsd: number | null;
  costLocal: number | null;
  retailLocal: number;
  listLocal: number;
  override: OverrideRow | null;
};

type CatalogFilterField = {
  key: string;
  label: string;
  options: Array<{ id: string; label: string }>;
  required?: boolean;
};

type CatalogResponse = {
  ok: true;
  provider: ProviderKey;
  currency: string;
  filters: {
    fields: CatalogFilterField[];
    applied: Record<string, string>;
  };
  items: CatalogItem[];
  demo: boolean;
  hint?: string;
};

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  jap: "Social (JAP)",
  herosms: "5sim Numbers",
  reloadly: "Gift cards (buy)",
  sogo: "Gift cards (sell)",
  vtpass: "Airtime / Data / Bills (VTpass)",
};

function markupToPercent(markup: number) {
  return Math.round((markup - 1) * 1000) / 10;
}

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

type EditState = {
  mode: OverrideRow["mode"];
  value: string;
};

export default function AdminPricingPage() {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<PricingConfig | null>(null);
  const [bulkProvider, setBulkProvider] = useState<ProviderKey>("jap");
  const [bulkPercent, setBulkPercent] = useState("5");

  const [catalogProvider, setCatalogProvider] = useState<ProviderKey>("jap");
  const [catalogFilters, setCatalogFilters] = useState<Record<string, string>>({
    platform: "All",
    channel: "numbers",
    identifier: "data",
    countryCode: "US",
  });
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, EditState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = await pricingFetch<PricingResponse>("/api/admin/pricing");
      setData(json);
      setDraft(json.config);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const qs = new URLSearchParams({ provider: catalogProvider });
      for (const [k, v] of Object.entries(catalogFilters)) {
        if (v) qs.set(k, v);
      }
      if (catalogSearch.trim()) qs.set("q", catalogSearch.trim());
      const json = await pricingFetch<CatalogResponse>(
        `/api/admin/pricing/catalog?${qs.toString()}`,
      );
      setCatalog(json);
      const nextEdits: Record<string, EditState> = {};
      for (const item of json.items) {
        if (item.override) {
          nextEdits[item.serviceKey] = {
            mode: item.override.mode,
            value: String(item.override.value),
          };
        } else {
          nextEdits[item.serviceKey] = {
            mode: "fixed",
            value: String(item.retailLocal),
          };
        }
      }
      setEdits(nextEdits);
    } catch (e) {
      setCatalogError(e instanceof Error ? e.message : "Failed to load catalog");
      setCatalog(null);
    } finally {
      setCatalogLoading(false);
    }
  }, [catalogProvider, catalogFilters, catalogSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadCatalog();
    // Only reload when provider / filter picks change — not every keystroke on search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogProvider, catalogFilters.platform, catalogFilters.channel, catalogFilters.service, catalogFilters.site, catalogFilters.countryCode, catalogFilters.identifier, catalogFilters.serviceID]);

  const overrides = useMemo(() => data?.overrides ?? [], [data]);

  async function saveGroup() {
    if (!draft) return;
    setSaving(true);
    setMessage(null);
    try {
      await pricingFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({ action: "save_config", config: draft }),
      });
      setMessage("Group markups saved. App catalogs will use the new prices.");
      await load();
      await loadCatalog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function applyBulk() {
    setSaving(true);
    setMessage(null);
    try {
      await pricingFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          action: "bulk_percent",
          provider: bulkProvider,
          percent: Number(bulkPercent),
        }),
      });
      setMessage(
        `Adjusted ${PROVIDER_LABELS[bulkProvider]} group markup by ${bulkPercent}%`,
      );
      await load();
      await loadCatalog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk adjust failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveItemOverride(item: CatalogItem) {
    const edit = edits[item.serviceKey];
    if (!edit) return;
    const value = Number(edit.value);
    if (!Number.isFinite(value)) {
      setError("Enter a valid override value");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await pricingFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          action: "upsert_override",
          override: {
            provider: catalogProvider,
            serviceKey: item.serviceKey,
            label: item.title,
            mode: edit.mode,
            value,
            active: true,
          },
        }),
      });
      setMessage(`Updated price for ${item.title}`);
      await load();
      await loadCatalog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override save failed");
    } finally {
      setSaving(false);
    }
  }

  async function clearItemOverride(item: CatalogItem) {
    if (!item.override?.id) return;
    setSaving(true);
    try {
      await pricingFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          action: "delete_override",
          deleteOverrideId: item.override.id,
        }),
      });
      setMessage(`Cleared override for ${item.title}`);
      await load();
      await loadCatalog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeOverride(id: string) {
    setSaving(true);
    try {
      await pricingFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          action: "delete_override",
          deleteOverrideId: id,
        }),
      });
      await load();
      await loadCatalog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  function setFilter(key: string, value: string) {
    setCatalogFilters((prev) => {
      const next = { ...prev, [key]: value };
      // Reset dependent picks
      if (key === "channel") {
        delete next.service;
        delete next.site;
      }
      if (key === "identifier") {
        delete next.serviceID;
      }
      return next;
    });
  }

  return (
    <>
      <AdminPageHeader
        title="Service pricing"
        subtitle="Group markups and per-service overrides. Select a service to browse live prices and update any item."
      />

      {message ? (
        <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="space-y-6">
        <AdminCard title="Group markups">
          {loading ? <AdminLoadingBlock variant="table" rows={5} /> : null}
          {error ? <AdminErrorBlock message={error} onRetry={load} /> : null}
          {draft ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Markup 1.30 = +30% on provider USD × FX. Sogo uses payout share
                (1 = pass-through).
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(Object.keys(draft.providers) as ProviderKey[]).map((key) => {
                  const row = draft.providers[key];
                  return (
                    <label
                      key={key}
                      className="rounded-xl border border-border bg-background p-4"
                    >
                      <div className="mb-2 text-sm font-semibold">
                        {PROVIDER_LABELS[key]}
                      </div>
                      {key === "sogo" ? (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Payout share (0–1)
                          </span>
                          <input
                            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                            type="number"
                            step="0.01"
                            min={0.01}
                            max={1}
                            value={row.payoutShare ?? 1}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                providers: {
                                  ...draft.providers,
                                  sogo: {
                                    ...row,
                                    payoutShare: Number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">
                            Markup (e.g. 1.25) · ~{markupToPercent(row.markup)}%
                          </span>
                          <input
                            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                            type="number"
                            step="0.01"
                            min={1}
                            value={row.markup}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                providers: {
                                  ...draft.providers,
                                  [key]: {
                                    ...row,
                                    markup: Number(e.target.value),
                                  },
                                },
                              })
                            }
                          />
                        </>
                      )}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveGroup()}
                className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                Save group pricing
              </button>
            </div>
          ) : null}
        </AdminCard>

        <AdminCard title="Bulk percent adjust (group)">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Provider</span>
              <select
                className="rounded-lg border border-border px-3 py-2"
                value={bulkProvider}
                onChange={(e) =>
                  setBulkProvider(e.target.value as ProviderKey)
                }
              >
                {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map((k) => (
                  <option key={k} value={k}>
                    {PROVIDER_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">
                Percent (+/-)
              </span>
              <input
                className="w-28 rounded-lg border border-border px-3 py-2"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void applyBulk()}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Apply to group markup
            </button>
          </div>
        </AdminCard>

        <AdminCard title="Individual price update">
          <p className="mb-4 text-sm text-muted-foreground">
            Select a service category, browse live catalog prices, then update
            any row. No service key typing needed.
          </p>

          <div className="mb-4 flex flex-wrap gap-2">
            {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setCatalogProvider(k);
                  setCatalogSearch("");
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  catalogProvider === k
                    ? "bg-orange-500 text-white"
                    : "border border-border bg-background text-muted-foreground"
                }`}
              >
                {PROVIDER_LABELS[k]}
              </button>
            ))}
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(catalog?.filters.fields ?? []).map((field) => {
              return (
                <label key={field.key} className="text-sm">
                  <span className="mb-1 block text-muted-foreground">
                    {field.label}
                  </span>
                  <select
                    className="w-full rounded-lg border border-border px-3 py-2"
                    value={catalogFilters[field.key] || field.options[0]?.id || ""}
                    onChange={(e) => setFilter(field.key, e.target.value)}
                  >
                    {field.options.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
            {(catalogProvider === "jap" || catalogProvider === "reloadly") && (
              <label className="text-sm md:col-span-2">
                <span className="mb-1 block text-muted-foreground">Search</span>
                <div className="flex gap-2">
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder="Filter by name…"
                  />
                  <button
                    type="button"
                    onClick={() => void loadCatalog()}
                    className="rounded-lg border border-border px-3 py-2 text-sm font-semibold"
                  >
                    Search
                  </button>
                </div>
              </label>
            )}
          </div>

          {catalog?.hint ? (
            <p className="mb-3 text-xs text-muted-foreground">{catalog.hint}</p>
          ) : null}
          {catalog?.demo ? (
            <p className="mb-3 text-xs font-semibold text-amber-700">
              Demo catalog — connect provider keys for live prices.
            </p>
          ) : null}

          {catalogLoading ? <AdminLoadingBlock variant="table" rows={6} /> : null}
          {catalogError ? (
            <AdminErrorBlock message={catalogError} onRetry={loadCatalog} />
          ) : null}

          {!catalogLoading && catalog && catalog.items.length === 0 ? (
            <AdminEmptyBlock message="No priced services for this selection." />
          ) : null}

          {!catalogLoading && catalog && catalog.items.length > 0 ? (
            <AdminTable
              rows={catalog.items}
              rowKey={(row) => row.serviceKey}
              columns={[
                {
                  key: "service",
                  header: "Service",
                  cell: (row) => (
                    <div className="max-w-xs">
                      <div className="font-semibold text-sm">{row.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.subtitle}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {row.details}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "prices",
                  header: "Prices",
                  cell: (row) => (
                    <div className="text-xs space-y-0.5">
                      {row.costUsd != null ? (
                        <div>Cost ${row.costUsd.toFixed(4)}</div>
                      ) : null}
                      {row.costLocal != null ? (
                        <div>Provider {money(row.costLocal, row.currency)}</div>
                      ) : null}
                      <div className="font-semibold text-sm text-orange-600">
                        Retail {money(row.retailLocal, row.currency)}
                      </div>
                      {row.override ? (
                        <div className="text-emerald-700">
                          Override: {row.override.mode} {row.override.value}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">Group markup</div>
                      )}
                    </div>
                  ),
                },
                {
                  key: "edit",
                  header: "Update",
                  cell: (row) => {
                    const edit = edits[row.serviceKey] || {
                      mode: "fixed" as const,
                      value: String(row.retailLocal),
                    };
                    return (
                      <div className="flex flex-wrap items-end gap-2 min-w-[220px]">
                        <label className="text-xs">
                          <span className="mb-0.5 block text-muted-foreground">
                            Mode
                          </span>
                          <select
                            className="rounded-lg border border-border px-2 py-1.5 text-xs"
                            value={edit.mode}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.serviceKey]: {
                                  ...edit,
                                  mode: e.target.value as OverrideRow["mode"],
                                },
                              }))
                            }
                          >
                            <option value="fixed">Fixed price</option>
                            <option value="percent">Percent ±</option>
                            <option value="markup">Markup ×</option>
                          </select>
                        </label>
                        <label className="text-xs">
                          <span className="mb-0.5 block text-muted-foreground">
                            Value
                          </span>
                          <input
                            className="w-24 rounded-lg border border-border px-2 py-1.5 text-xs"
                            value={edit.value}
                            onChange={(e) =>
                              setEdits((prev) => ({
                                ...prev,
                                [row.serviceKey]: {
                                  ...edit,
                                  value: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveItemOverride(row)}
                          className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Save
                        </button>
                        {row.override ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void clearItemOverride(row)}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold text-red-600"
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    );
                  },
                },
              ]}
            />
          ) : null}
        </AdminCard>

        <AdminCard title="Active overrides">
          {!loading && overrides.length === 0 ? (
            <AdminEmptyBlock message="No individual overrides yet — group markups still apply." />
          ) : null}
          {overrides.length > 0 ? (
            <AdminTable
              rows={overrides}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "provider",
                  header: "Provider",
                  cell: (row) => PROVIDER_LABELS[row.provider] || row.provider,
                },
                {
                  key: "label",
                  header: "Service",
                  cell: (row) => (
                    <div>
                      <div className="text-sm font-semibold">
                        {row.label || row.serviceKey}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {row.serviceKey}
                      </div>
                    </div>
                  ),
                },
                {
                  key: "mode",
                  header: "Mode",
                  cell: (row) => row.mode,
                },
                {
                  key: "value",
                  header: "Value",
                  cell: (row) => String(row.value),
                },
                {
                  key: "actions",
                  header: "",
                  cell: (row) => (
                    <button
                      type="button"
                      className="text-sm font-semibold text-red-600"
                      onClick={() => void removeOverride(row.id)}
                    >
                      Remove
                    </button>
                  ),
                },
              ]}
            />
          ) : null}
        </AdminCard>
      </div>
    </>
  );
}
