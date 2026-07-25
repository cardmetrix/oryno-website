"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Switch } from "@/components/ui/switch";

export default function AdminSettingsPage() {
  return (
    <>
      <AdminPageHeader
        title="Admin Settings"
        subtitle="Console preferences, security, and operational defaults"
      />

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
              control={<Switch defaultChecked />}
            />
            <PrefRow
              label="Realtime activity"
              description="Stream admin activity feed"
              control={<Switch defaultChecked />}
            />
          </div>
        </AdminCard>

        <AdminCard title="Security defaults" delay={0.1}>
          <div className="space-y-4">
            <PrefRow
              label="Require 2FA for admins"
              description="OTP challenge on sensitive actions"
              control={<Switch defaultChecked />}
            />
            <PrefRow
              label="Freeze high-risk wallets"
              description="Auto-hold suspicious payout patterns"
              control={<Switch defaultChecked />}
            />
            <PrefRow
              label="Audit logging"
              description="Keep immutable admin action logs"
              control={<Switch defaultChecked />}
            />
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Operational defaults" delay={0.14} className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default payout SLA" value="5–30 minutes" />
          <Field label="Support email" value="support@oryno.com" />
          <Field label="Default currency display" value="User local currency" />
          <Field label="Gift cards module" value="Coming soon (disabled)" />
        </div>
        <motion.button
          type="button"
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="btn-primary mt-5 h-11 px-5 text-sm"
        >
          Save changes
        </motion.button>
      </AdminCard>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block rounded-[16px] border border-border px-4 py-3">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <input
        defaultValue={value}
        className="mt-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none"
      />
    </label>
  );
}
