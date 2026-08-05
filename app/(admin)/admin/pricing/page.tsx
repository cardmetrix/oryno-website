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

const PROVIDER_LABELS: Record<ProviderKey, string> = {
  jap: "Social (JAP)",
  herosms: "Numbers & Emails",
  reloadly: "Gift cards (buy)",
  sogo: "Gift cards (sell)",
  vtpass: "Airtime / Data / Bills",
};

function markupToPercent(markup: number) {
  return Math.round((markup - 1) * 1000) / 10;
}

export default function AdminPricingPage() {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<PricingConfig | null>(null);
  const [bulkProvider, setBulkProvider] = useState<ProviderKey>("jap");
  const [bulkPercent, setBulkPercent] = useState("5");
  const [form, setForm] = useState({
    provider: "jap" as ProviderKey,
    serviceKey: "",
    label: "",
    mode: "percent" as OverrideRow["mode"],
    value: "10",
  });

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

  useEffect(() => {
    void load();
  }, [load]);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk adjust failed");
    } finally {
      setSaving(false);
    }
  }

  async function upsertOverride() {
    setSaving(true);
    setMessage(null);
    try {
      await pricingFetch("/api/admin/pricing", {
        method: "PATCH",
        body: JSON.stringify({
          action: "upsert_override",
          override: {
            provider: form.provider,
            serviceKey: form.serviceKey.trim(),
            label: form.label.trim() || undefined,
            mode: form.mode,
            value: Number(form.value),
            active: true,
          },
        }),
      });
      setMessage("Individual override saved");
      setForm((f) => ({ ...f, serviceKey: "", label: "" }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Override save failed");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Service pricing"
        subtitle="Group markups and per-service overrides. Catalog + purchase paths use these values."
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

        <AdminCard title="Individual service override">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Provider</span>
              <select
                className="w-full rounded-lg border border-border px-3 py-2"
                value={form.provider}
                onChange={(e) =>
                  setForm({ ...form, provider: e.target.value as ProviderKey })
                }
              >
                {(Object.keys(PROVIDER_LABELS) as ProviderKey[]).map((k) => (
                  <option key={k} value={k}>
                    {PROVIDER_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-muted-foreground">
                Service key
              </span>
              <input
                className="w-full rounded-lg border border-border px-3 py-2"
                placeholder="jap: 1234 · herosms: 12:ot · vtpass: mtn-data:plan · reloadly: productId · sogo: slug"
                value={form.serviceKey}
                onChange={(e) =>
                  setForm({ ...form, serviceKey: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Mode</span>
              <select
                className="w-full rounded-lg border border-border px-3 py-2"
                value={form.mode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    mode: e.target.value as OverrideRow["mode"],
                  })
                }
              >
                <option value="percent">Percent ±</option>
                <option value="markup">Markup ×</option>
                <option value="fixed">Fixed local</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Value</span>
              <input
                className="w-full rounded-lg border border-border px-3 py-2"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
            <label className="text-sm md:col-span-2">
              <span className="mb-1 block text-muted-foreground">Label</span>
              <input
                className="w-full rounded-lg border border-border px-3 py-2"
                placeholder="Optional admin note"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </label>
          </div>
          <button
            type="button"
            disabled={saving || !form.serviceKey.trim()}
            onClick={() => void upsertOverride()}
            className="mt-4 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            Save override
          </button>
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
                  key: "serviceKey",
                  header: "Service key",
                  cell: (row) => (
                    <div>
                      <div className="font-mono text-xs">{row.serviceKey}</div>
                      {row.label ? (
                        <div className="text-xs text-muted-foreground">
                          {row.label}
                        </div>
                      ) : null}
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
