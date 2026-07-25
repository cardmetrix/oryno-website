"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { giftCardOrders, giftCardRates } from "@/lib/admin-data";

export default function AdminGiftCardsPage() {
  return (
    <>
      <AdminPageHeader
        title="Gift Cards"
        subtitle="Live rates and order tracking — marketplace launching soon"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Update rates
          </motion.button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminCard title="Exchange rates" delay={0.05}>
          <AdminTable
            rows={giftCardRates.map((r) => ({ ...r, id: r.brand }))}
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
              { key: "sell", header: "Sell", cell: (row) => row.sell },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusBadge status={row.status} />,
              },
            ]}
          />
        </AdminCard>

        <AdminCard title="Orders" delay={0.1}>
          <AdminTable
            rows={giftCardOrders}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "id",
                header: "Order",
                cell: (row) => (
                  <span className="font-semibold text-foreground">{row.id}</span>
                ),
              },
              { key: "user", header: "User", cell: (row) => row.user },
              {
                key: "brand",
                header: "Details",
                cell: (row) => `${row.brand} · ${row.type} · ${row.amount}`,
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => <StatusBadge status={row.status} />,
              },
            ]}
          />
        </AdminCard>
      </div>
    </>
  );
}
