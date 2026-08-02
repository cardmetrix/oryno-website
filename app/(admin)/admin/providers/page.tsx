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

type Provider = {
  id: string;
  name: string;
  type: string;
  country: string;
  status: string;
};

export default function AdminProvidersPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    providers: Provider[];
  }>("/api/admin/providers");

  return (
    <>
      <AdminPageHeader
        title="Providers"
        subtitle="Live / sandbox / demo status for integrated services"
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.providers.length === 0 ? (
            <AdminEmptyBlock message="No providers configured." />
          ) : (
            <AdminTable
              rows={data.providers}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "name",
                  header: "Provider",
                  cell: (row) => (
                    <span className="font-semibold text-foreground">
                      {row.name}
                    </span>
                  ),
                },
                { key: "type", header: "Services", cell: (row) => row.type },
                {
                  key: "country",
                  header: "Scope",
                  cell: (row) => row.country,
                },
                {
                  key: "status",
                  header: "Mode",
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
