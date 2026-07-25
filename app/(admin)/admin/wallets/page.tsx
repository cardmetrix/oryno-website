"use client";

import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { adminWallets } from "@/lib/admin-data";

export default function AdminWalletsPage() {
  return (
    <>
      <AdminPageHeader
        title="Wallets"
        subtitle="Balances, freezes, and multi-currency health"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total ledger (NGN eq.)" value="₦842.6M" change="+8.1% MoM" up delay={0} />
        <StatCard label="Frozen wallets" value="14" change="Security holds" up={false} delay={0.05} />
        <StatCard label="Payouts today" value="1,208" change="5–30 min avg" up delay={0.1} />
      </div>

      <AdminCard title="Wallet ledger" delay={0.12}>
        <AdminTable
          rows={adminWallets}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "user",
              header: "User",
              cell: (row) => (
                <span className="font-semibold text-foreground">{row.user}</span>
              ),
            },
            {
              key: "currency",
              header: "Currency",
              cell: (row) => row.currency,
            },
            {
              key: "balance",
              header: "Balance",
              cell: (row) => (
                <span className="font-semibold text-foreground">
                  {row.balance}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "actions",
              header: "",
              cell: (row) => (
                <button type="button" className="text-sm font-semibold text-primary">
                  {row.status === "Frozen" ? "Unfreeze" : "Freeze"}
                </button>
              ),
            },
          ]}
        />
      </AdminCard>
    </>
  );
}
