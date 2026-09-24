"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { StatCard } from "@/components/admin/stat-card";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type InvoicesResponse = {
  settings: { enabled: boolean; paymentLinksEnabled: boolean };
  invoices: Array<{
    id: string;
    customer: string;
    amount: string;
    status: string;
    createdAt?: string;
  }>;
};

export default function AdminInvoicesPage() {
  const { data, loading, error, reload } =
    useAdminQuery<InvoicesResponse>("/api/admin/invoices");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [paymentLinksEnabled, setPaymentLinksEnabled] = useState<boolean | null>(
    null,
  );

  const settingsEnabled = enabled ?? data?.settings.enabled ?? true;
  const settingsPay =
    paymentLinksEnabled ?? data?.settings.paymentLinksEnabled ?? true;

  async function saveSettings(next: {
    enabled: boolean;
    paymentLinksEnabled: boolean;
  }) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setEnabled(next.enabled);
      setPaymentLinksEnabled(next.paymentLinksEnabled);
      toast.success("Invoice settings updated");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Invoices"
        subtitle="Invoice generator · payment links · PDF downloads"
      />
      {loading ? <AdminLoadingBlock variant="split" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
      {data ? (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Invoices loaded"
              value={String(data.invoices.length)}
            />
            <StatCard
              label="Generator"
              value={settingsEnabled ? "On" : "Off"}
              delay={0.04}
            />
            <StatCard
              label="Payment links"
              value={settingsPay ? "On" : "Off"}
              delay={0.08}
            />
          </div>

          <AdminCard title="Settings" delay={0.05}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settingsEnabled}
                  disabled={busy}
                  onChange={(e) =>
                    void saveSettings({
                      enabled: e.target.checked,
                      paymentLinksEnabled: settingsPay,
                    })
                  }
                />
                Invoice generator enabled
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={settingsPay}
                  disabled={busy}
                  onChange={(e) =>
                    void saveSettings({
                      enabled: settingsEnabled,
                      paymentLinksEnabled: e.target.checked,
                    })
                  }
                />
                Payment links enabled
              </label>
            </div>
          </AdminCard>

          <AdminCard title="Recent invoices" delay={0.1}>
            {data.invoices.length === 0 ? (
              <AdminEmptyBlock message="No invoices yet." />
            ) : (
              <AdminTable
                rows={data.invoices.map((r) => ({ ...r }))}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "id",
                    header: "Invoice",
                    cell: (row) => (
                      <span className="font-semibold">{row.id}</span>
                    ),
                  },
                  {
                    key: "customer",
                    header: "Customer",
                    cell: (row) => row.customer,
                  },
                  {
                    key: "amount",
                    header: "Amount",
                    cell: (row) => row.amount,
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
              />
            )}
          </AdminCard>
        </div>
      ) : null}
    </>
  );
}
