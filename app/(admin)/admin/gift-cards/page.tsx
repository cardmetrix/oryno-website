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

type GiftCardsResponse = {
  rates: Array<{ brand: string; buy: string; sell: string; status: string }>;
  orders: Array<{
    id: string;
    user: string;
    brand: string;
    type: string;
    amount: string;
    status: string;
  }>;
};

export default function AdminGiftCardsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<GiftCardsResponse>("/api/admin/gift-cards");

  const buyOrders = (data?.orders || []).filter(
    (o) => o.type.toLowerCase() === "buy",
  );

  return (
    <>
      <AdminPageHeader
        title="Gift Cards"
        subtitle="Buy-only · Reloadly orders and brand rates"
      />

      {loading ? <AdminLoadingBlock variant="split" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <AdminCard title="Buy rates" delay={0.05}>
            {data.rates.length === 0 ? (
              <AdminEmptyBlock message="No gift card brands/rates in the database yet." />
            ) : (
              <AdminTable
                rows={data.rates.map((r) => ({ ...r, id: r.brand }))}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "brand",
                    header: "Brand",
                    cell: (row) => (
                      <span className="font-semibold text-foreground">
                        {row.brand}
                      </span>
                    ),
                  },
                  { key: "buy", header: "Buy", cell: (row) => row.buy },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.status} />,
                  },
                ]}
              />
            )}
          </AdminCard>

          <AdminCard title="Buy orders" delay={0.1}>
            {buyOrders.length === 0 ? (
              <AdminEmptyBlock message="No gift card buy orders yet." />
            ) : (
              <AdminTable
                rows={buyOrders}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "id",
                    header: "Order",
                    cell: (row) => (
                      <span className="font-semibold text-foreground">
                        {row.id}
                      </span>
                    ),
                  },
                  { key: "user", header: "User", cell: (row) => row.user },
                  {
                    key: "brand",
                    header: "Details",
                    cell: (row) =>
                      `${row.brand} · ${row.type} · ${row.amount}`,
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
