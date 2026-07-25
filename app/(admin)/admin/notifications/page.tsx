"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { adminNotifications } from "@/lib/admin-data";

export default function AdminNotificationsPage() {
  return (
    <>
      <AdminPageHeader
        title="Notifications"
        subtitle="Push alerts, promos, and system broadcasts"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Compose
          </motion.button>
        }
      />

      <AdminCard>
        <AdminTable
          rows={adminNotifications}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "title",
              header: "Campaign",
              cell: (row) => (
                <span className="font-semibold text-foreground">
                  {row.title}
                </span>
              ),
            },
            {
              key: "audience",
              header: "Audience",
              cell: (row) => row.audience,
            },
            { key: "when", header: "When", cell: (row) => row.when },
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
