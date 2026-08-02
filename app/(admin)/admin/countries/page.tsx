"use client";

import { FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  COUNTRY_PRESETS,
  COUNTRY_STATUS_OPTIONS,
  DEFAULT_COUNTRY_SERVICES,
  type CountryStatus,
} from "@/lib/admin/countries";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type Country = {
  code: string;
  name: string;
  currency: string;
  currencySymbol: string;
  flagEmoji: string | null;
  services: string[];
  servicesLabel: string;
  gateway: string;
  status: CountryStatus;
  statusLabel: string;
  giftCardsEnabled: boolean;
};

type Preset = (typeof COUNTRY_PRESETS)[number];

type Response = {
  countries: Country[];
  presets: Preset[];
  statusOptions: typeof COUNTRY_STATUS_OPTIONS;
};

export default function AdminCountriesPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/countries");
  const [addOpen, setAddOpen] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  async function setStatus(code: string, status: CountryStatus) {
    setBusyCode(code);
    try {
      const res = await fetch(`/api/admin/countries/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update country");
      toast.success(`${code} is now ${json.country?.statusLabel || status}`);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Countries"
        subtitle="Add markets and set Live, Suspended, or Disabled"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setAddOpen(true)}
            className="btn-primary inline-flex h-11 items-center gap-1.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add country
          </motion.button>
        }
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock variant="cards" /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.countries.length === 0 ? (
            <AdminEmptyBlock message="No countries yet. Add your first market." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.countries.map((country, index) => (
                <motion.div
                  key={country.code}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="rounded-[18px] border border-border bg-muted/40 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {country.flagEmoji ? `${country.flagEmoji} ` : ""}
                      {country.name}
                    </p>
                    <StatusBadge status={country.statusLabel} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {country.code} · {country.currencySymbol || country.currency}{" "}
                    · {country.gateway}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                    {country.servicesLabel}
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-1.5">
                    {COUNTRY_STATUS_OPTIONS.map((opt) => {
                      const active = country.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={busyCode === country.code || active}
                          onClick={() => void setStatus(country.code, opt.value)}
                          className={cn(
                            "h-9 rounded-xl text-[11px] font-semibold transition",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                            "disabled:opacity-60",
                          )}
                          title={opt.description}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : null}
      </AdminCard>

      <AddCountryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        presets={data?.presets || []}
        existingCodes={new Set(data?.countries.map((c) => c.code) || [])}
        onCreated={async () => {
          setAddOpen(false);
          await reload();
        }}
      />
    </>
  );
}

function AddCountryDialog({
  open,
  onOpenChange,
  presets,
  existingCodes,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: Preset[];
  existingCodes: Set<string>;
  onCreated: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");
  const [currencySymbol, setCurrencySymbol] = useState("");
  const [flagEmoji, setFlagEmoji] = useState("");
  const [status, setStatus] = useState<CountryStatus>("beta");
  const [giftCardsEnabled, setGiftCardsEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const availablePresets = useMemo(
    () => presets.filter((p) => !existingCodes.has(p.code)),
    [presets, existingCodes],
  );

  function applyPreset(preset: Preset) {
    setCode(preset.code);
    setName(preset.name);
    setCurrency(preset.currency);
    setCurrencySymbol(preset.currencySymbol);
    setFlagEmoji(preset.flagEmoji);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/countries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          name,
          currency,
          currencySymbol,
          flagEmoji,
          status,
          giftCardsEnabled,
          enabledServices: DEFAULT_COUNTRY_SERVICES,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to add country");
      toast.success(`${json.country?.name || code} added`);
      setCode("");
      setName("");
      setCurrency("");
      setCurrencySymbol("");
      setFlagEmoji("");
      setStatus("beta");
      setGiftCardsEnabled(false);
      await onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add country");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add country</DialogTitle>
          <DialogDescription>
            Create a market with ISO code, currency, and availability status.
          </DialogDescription>
        </DialogHeader>

        {availablePresets.length ? (
          <div className="flex flex-wrap gap-2">
            {availablePresets.slice(0, 10).map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => applyPreset(p)}
                className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-semibold hover:border-primary/40"
              >
                {p.flagEmoji} {p.code}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="ISO code"
              value={code}
              onChange={(v) => setCode(v.toUpperCase().slice(0, 2))}
              placeholder="NG"
              required
            />
            <Field
              label="Currency"
              value={currency}
              onChange={(v) => setCurrency(v.toUpperCase().slice(0, 3))}
              placeholder="NGN"
              required
            />
          </div>
          <Field
            label="Country name"
            value={name}
            onChange={setName}
            placeholder="Nigeria"
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Symbol"
              value={currencySymbol}
              onChange={setCurrencySymbol}
              placeholder="₦"
            />
            <Field
              label="Flag emoji"
              value={flagEmoji}
              onChange={setFlagEmoji}
              placeholder="🇳🇬"
            />
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CountryStatus)}
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm"
            >
              {COUNTRY_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={giftCardsEnabled}
              onChange={(e) => setGiftCardsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Enable gift cards for this country
          </label>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary h-11 w-full text-sm disabled:opacity-60"
          >
            {saving ? "Adding…" : "Add country"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary"
      />
    </label>
  );
}
