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

type UserRow = {
  id: string;
  name: string;
  email: string;
  country: string;
  status: string;
  kyc: string;
  balance: string;
};

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const url = useMemo(
    () => `/api/admin/users${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`,
    [q],
  );
  const { data, loading, error, reload } = useAdminQuery<{ users: UserRow[] }>(
    url,
  );

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Accounts, KYC status, and wallet balances"
        actions={
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search users…"
              className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-56"
            />
          </div>
        }
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock variant="table" rows={8} /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && data ? (
          data.users.length === 0 ? (
            <AdminEmptyBlock message="No users found." />
          ) : (
            <AdminTable
              rows={data.users}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "User",
                  cell: (row) => (
                    <div>
                      <p className="font-semibold text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email}</p>
                    </div>
                  ),
                },
                {
                  key: "country",
                  header: "Country",
                  cell: (row) => (
                    <span className="text-foreground">{row.country}</span>
                  ),
                },
                {
                  key: "kyc",
                  header: "KYC",
                  cell: (row) => <StatusBadge status={row.kyc} />,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: "balance",
                  header: "Wallet",
                  cell: (row) => (
                    <span className="font-semibold text-foreground">
                      {row.balance}
                    </span>
                  ),
                },
              ]}
            />
          )
        ) : null}
      </AdminCard>
    </>
  );
}
