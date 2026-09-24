"use client";

import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type InvoicesResponse = {
  settings: { enabled: boolean; paymentLinksEnabled: boolean };
  invoices: Array<{
    id: string;
    customer: string;
    amount: string;
    status: string;
  }>;
};

export default function AdminInvoicesPage() {
  const { data, loading, error, reload } =
    useAdminQuery<InvoicesResponse>("/api/admin/invoices");

  return (
    <>
      <AdminPageHeader
        title="Invoices"
        subtitle="Free invoice generator · payment links"
      />
      {loading ? <AdminLoadingBlock variant="split" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
      {data ? (
        <div className="grid gap-5">
          <AdminCard title="Settings" delay={0.05}>
            <p className="text-sm text-muted-foreground">
              Invoices: {data.settings.enabled ? "Enabled" : "Disabled"} · Payment
              links:{" "}
              {data.settings.paymentLinksEnabled ? "Enabled" : "Disabled"}
            </p>
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
                  { key: "customer", header: "Customer", cell: (row) => row.customer },
                  { key: "amount", header: "Amount", cell: (row) => row.amount },
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
