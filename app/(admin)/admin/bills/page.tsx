"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { billProviders } from "@/lib/admin-data";

export default function AdminBillsPage() {
  return (
    <>
      <AdminPageHeader
        title="Bill Providers"
        subtitle="Electricity, TV, and utility providers by country config"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Add bill provider
          </motion.button>
        }
      />

      <AdminCard>
        <AdminTable
          rows={billProviders}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Provider",
              cell: (row) => (
                <span className="font-semibold text-foreground">{row.name}</span>
              ),
            },
            {
              key: "category",
              header: "Category",
              cell: (row) => row.category,
            },
            { key: "country", header: "Country", cell: (row) => row.country },
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
                  Edit
                </button>
              ),
            },
          ]}
        />
      </AdminCard>
    </>
  );
}
