"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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

type WalletRow = {
  id: string;
  user: string;
  email: string;
  currency: string;
  balance: string;
  status: string;
};

export default function AdminWalletsPage() {
  const [q, setQ] = useState("");
  const url = useMemo(
    () =>
      `/api/admin/wallets${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
    [q],
  );
  const { data, loading, error, reload } = useAdminQuery<{
    wallets: WalletRow[];
  }>(url);

  return (
    <>
      <AdminPageHeader
        title="Wallets"
        subtitle="Balances and freeze status across currencies"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search wallets…"
              className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-56"
            />
          </div>
        }
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && data ? (
          data.wallets.length === 0 ? (
            <AdminEmptyBlock message="No wallets found." />
          ) : (
            <AdminTable
              rows={data.wallets}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "user",
                  header: "User",
                  cell: (row) => (
                    <div>
                      <p className="font-semibold text-foreground">{row.user}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
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
                    <span className="font-semibold">{row.balance}</span>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <StatusBadge status={row.status} />,
                },
              ]}
            />
          )
        ) : null}
      </AdminCard>
    </>
  );
}
