"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { virtualNumberStock } from "@/lib/admin-data";

export default function AdminVirtualNumbersPage() {
  return (
    <>
      <AdminPageHeader
        title="Virtual Numbers"
        subtitle="Stock for buy & rent SMS verification inventory"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Restock
          </motion.button>
        }
      />

      <AdminCard>
        <AdminTable
          rows={virtualNumberStock.map((r) => ({ ...r, id: r.country }))}
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
            {
              key: "actions",
              header: "",
              cell: () => (
                <button type="button" className="text-sm font-semibold text-primary">
                  Manage
                </button>
              ),
            },
          ]}
        />
      </AdminCard>
    </>
  );
}
