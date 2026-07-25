"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { serviceProviders } from "@/lib/admin-data";

export default function AdminProvidersPage() {
  return (
    <>
      <AdminPageHeader
        title="Airtime & Data Providers"
        subtitle="Configured per country — not hardcoded in product logic"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Add provider
          </motion.button>
        }
      />

      <AdminCard>
        <AdminTable
          rows={serviceProviders}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Provider",
              cell: (row) => (
                <span className="font-semibold text-foreground">{row.name}</span>
              ),
            },
            { key: "type", header: "Type", cell: (row) => row.type },
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
                  Configure
                </button>
              ),
            },
          ]}
        />
      </AdminCard>
    </>
  );
}
