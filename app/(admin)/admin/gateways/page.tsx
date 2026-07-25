"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { gateways } from "@/lib/admin-data";

export default function AdminGatewaysPage() {
  return (
    <>
      <AdminPageHeader
        title="Payment Gateways"
        subtitle="Paystack, Flutterwave, and expandable gateway slots"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Connect gateway
          </motion.button>
        }
      />

      <AdminCard>
        <AdminTable
          rows={gateways}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "Gateway",
              cell: (row) => (
                <span className="font-semibold text-foreground">{row.name}</span>
              ),
            },
            {
              key: "countries",
              header: "Countries",
              cell: (row) => row.countries,
            },
            { key: "mode", header: "Mode", cell: (row) => row.mode },
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
                  Settings
                </button>
              ),
            },
          ]}
        />
      </AdminCard>

      <AdminCard title="Routing note" delay={0.1} className="mt-5">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Withdrawals credit the user wallet first, then route to the correct
          local bank or mobile money integration based on the user’s country
          configuration. Adding a country should only require new config +
          provider credentials — not product rewrites.
        </p>
      </AdminCard>
    </>
  );
}
