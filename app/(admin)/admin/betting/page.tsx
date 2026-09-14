"use client";

import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type Response = {
  demo?: boolean;
  revenue?: {
    volume30d: number;
    completed30d: number;
    profit30d: number;
    revenueEntries30d: number;
    charge: {
      mode: "flat" | "percent";
      value: number;
      enabled: boolean;
    };
  };
  providers: Array<{
    id: string;
    name: string;
    status: string;
    minAmount: number;
    maxAmount: number;
  }>;
  recent: Array<{
    id: string;
    provider: string;
    customerRef: string;
    customerName: string;
    amount: string;
    status: string;
    reference: string;
    when: string;
  }>;
};

function money(n: number) {
  return `₦${n.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminBettingPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/betting");

  const revenue = data?.revenue;
  const chargeLabel = revenue?.charge
    ? !revenue.charge.enabled
      ? "Off"
      : revenue.charge.mode === "percent"
        ? `${revenue.charge.value}%`
        : money(revenue.charge.value)
    : "—";

  return (
    <>
      <AdminPageHeader
        title="Betting Funding"
        subtitle={
          data?.demo
            ? "Demo mode — catalog + recent wallet funding tests"
            : "Bookmakers, funding volume, and company profit"
        }
      />

      {loading ? <AdminLoadingBlock variant="table" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data && revenue ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Volume (30d)"
            value={money(revenue.volume30d)}
            change={`${revenue.completed30d} completed funds`}
          />
          <StatCard
            label="Company profit (30d)"
            value={money(revenue.profit30d)}
            change={`${revenue.revenueEntries30d} revenue entries`}
            up={revenue.profit30d > 0}
          />
          <StatCard
            label="Betting charge"
            value={chargeLabel}
            change="Edit under Admin → Revenue"
          />
          <StatCard
            label="Live mode"
            value={data.demo ? "Demo" : "Live"}
            change="Open /admin/revenue to tune fee"
          />
        </div>
      ) : null}

      <AdminCard title="Bookmakers">
        {data ? (
          data.providers.length === 0 ? (
            <AdminEmptyBlock message="No betting providers configured." />
          ) : (
            <AdminTable
              rows={data.providers}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Bookmaker",
                  cell: (row) => (
                    <span className="font-semibold text-foreground">
                      {row.name}
                    </span>
                  ),
                },
                {
                  key: "id",
                  header: "Code",
                  cell: (row) => row.id,
                },
                {
                  key: "minAmount",
                  header: "Min",
                  cell: (row) => `₦${row.minAmount}`,
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

      <AdminCard title="Recent funding" className="mt-6">
        {data && data.recent.length === 0 ? (
          <AdminEmptyBlock message="No betting funding yet." />
        ) : data ? (
          <AdminTable
            rows={data.recent}
            rowKey={(row) => row.id}
            columns={[
              { key: "when", header: "When", cell: (row) => row.when },
              { key: "provider", header: "Bookmaker", cell: (row) => row.provider },
              {
                key: "customerRef",
                header: "Account",
                cell: (row) => row.customerRef,
              },
              {
                key: "customerName",
                header: "Name",
                cell: (row) => row.customerName,
              },
              { key: "amount", header: "Amount", cell: (row) => `₦${row.amount}` },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusBadge status={row.status} />,
              },
              {
                key: "reference",
                header: "Ref",
                cell: (row) => row.reference,
              },
            ]}
          />
        ) : null}
      </AdminCard>
    </>
  );
}
