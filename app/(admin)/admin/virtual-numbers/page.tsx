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
  stock: Array<{ country: string; buy: number; rent: number; status: string }>;
  totalRented: number;
};

export default function AdminVirtualNumbersPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/virtual-numbers");

  return (
    <>
      <AdminPageHeader
        title="Virtual Numbers"
        subtitle={
          data
            ? `${data.totalRented} active rentals · HeroSMS inventory`
            : "Stock for buy & rent SMS verification inventory"
        }
      />

      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          data.stock.length === 0 ? (
            <AdminEmptyBlock message="No virtual number stock or rentals yet." />
          ) : (
            <AdminTable
              rows={data.stock.map((r) => ({ ...r, id: r.country }))}
              rowKey={(row) => row.id}
              columns={[
                {
                  key: "country",
                  header: "Country",
                  cell: (row) => (
                    <span className="font-semibold text-foreground">
                      {row.country}
                    </span>
                  ),
                },
                { key: "buy", header: "Buy stock", cell: (row) => row.buy },
                { key: "rent", header: "Rent stock", cell: (row) => row.rent },
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
