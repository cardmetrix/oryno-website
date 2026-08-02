"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type Settings = {
  compactTables: boolean;
  realtimeActivity: boolean;
  requireAdmin2fa: boolean;
  freezeHighRiskWallets: boolean;
  auditLogging: boolean;
  payoutSla: string;
  supportEmail: string;
  defaultCurrencyDisplay: string;
  giftCardsModule: string;
};

export default function AdminSettingsPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    settings: Settings;
  }>("/api/admin/settings");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.settings) setSettings(data.settings);
  }, [data]);

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save");
      setSettings(json.settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Admin Settings"
        subtitle="Console preferences, security, and operational defaults"
      />

      {loading ? <AdminLoadingBlock variant="settings" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {settings ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <AdminCard title="Console preferences" delay={0.05}>
              <div className="space-y-4">
                <PrefRow
                  label="Dark mode"
                  description="Match ORYNO brand dark surfaces"
                  control={<ThemeToggle />}
                />
                <PrefRow
                  label="Compact tables"
                  description="Show denser rows on large screens"
                  control={
                    <Switch
                      checked={settings.compactTables}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, compactTables: v })
                      }
                    />
                  }
                />
                <PrefRow
                  label="Realtime activity"
                  description="Stream admin activity feed"
                  control={
                    <Switch
                      checked={settings.realtimeActivity}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, realtimeActivity: v })
                      }
                    />
                  }
                />
              </div>
            </AdminCard>

            <AdminCard title="Security defaults" delay={0.1}>
              <div className="space-y-4">
                <PrefRow
                  label="Require 2FA for admins"
                  description="OTP challenge on sensitive actions"
                  control={
                    <Switch
                      checked={settings.requireAdmin2fa}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, requireAdmin2fa: v })
                      }
                    />
                  }
                />
                <PrefRow
                  label="Freeze high-risk wallets"
                  description="Auto-hold suspicious payout patterns"
                  control={
                    <Switch
                      checked={settings.freezeHighRiskWallets}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, freezeHighRiskWallets: v })
                      }
                    />
                  }
                />
                <PrefRow
                  label="Audit logging"
                  description="Keep immutable admin action logs"
                  control={
                    <Switch
                      checked={settings.auditLogging}
                      onCheckedChange={(v) =>
                        setSettings({ ...settings, auditLogging: v })
                      }
                    />
                  }
                />
              </div>
            </AdminCard>
          </div>

          <AdminCard title="Operational defaults" delay={0.14} className="mt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Default payout SLA"
                value={settings.payoutSla}
                onChange={(v) => setSettings({ ...settings, payoutSla: v })}
              />
              <Field
                label="Support email"
                value={settings.supportEmail}
                onChange={(v) => setSettings({ ...settings, supportEmail: v })}
              />
              <Field
                label="Default currency display"
                value={settings.defaultCurrencyDisplay}
                onChange={(v) =>
                  setSettings({ ...settings, defaultCurrencyDisplay: v })
                }
              />
              <Field
                label="Gift cards module"
                value={settings.giftCardsModule}
                onChange={(v) =>
                  setSettings({ ...settings, giftCardsModule: v })
                }
              />
            </div>
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={saving}
              onClick={() => void save()}
              className="btn-primary mt-5 h-11 px-5 text-sm disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </motion.button>
          </AdminCard>
        </>
      ) : null}
    </>
  );
}

function PrefRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[16px] border border-border px-4 py-3.5">
      <div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block rounded-[16px] border border-border px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
      />
    </label>
  );
}
