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

type Gateway = {
  id: string;
  name: string;
  countries: string;
  status: string;
  mode: string;
};

export default function AdminGatewaysPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    gateways: Gateway[];
  }>("/api/admin/gateways");

  return (
    <>
      <AdminPageHeader
        title="Gateways"
        subtitle="Payment providers and country assignments"
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.gateways.length === 0 ? (
            <AdminEmptyBlock message="No payment gateways configured." />
          ) : (
            <AdminTable
              rows={data.gateways}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Gateway",
                  cell: (row) => (
                    <span className="font-semibold text-foreground">
                      {row.name}
                    </span>
                  ),
                },
                {
                  key: "countries",
                  header: "Countries",
                  cell: (row) => row.countries,
                },
                {
                  key: "status",
                  header: "Status",
                  cell: (row) => <StatusBadge status={row.status} />,
                },
                {
                  key: "mode",
                  header: "Mode",
                  cell: (row) => <StatusBadge status={row.mode} />,
                },
              ]}
            />
          )
        ) : null}
      </AdminCard>
    </>
  );
}
