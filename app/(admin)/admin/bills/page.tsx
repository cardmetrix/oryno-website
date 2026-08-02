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

type Response = {
  providers: Array<{
    id: string;
    name: string;
    category: string;
    country: string;
    status: string;
  }>;
};

export default function AdminBillsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/bills");

  return (
    <>
      <AdminPageHeader
        title="Bill Providers"
        subtitle="Electricity, TV, and other billers from the database"
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.providers.length === 0 ? (
            <AdminEmptyBlock message="No bill providers in the database yet." />
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
                {
                  key: "category",
                  header: "Category",
                  cell: (row) => row.category,
                },
                {
                  key: "country",
                  header: "Country",
                  cell: (row) => row.country,
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
