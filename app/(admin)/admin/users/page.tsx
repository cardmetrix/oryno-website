"use client";

import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { adminUsers } from "@/lib/admin-data";

export default function AdminUsersPage() {
  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle="Manage accounts, KYC status, and access"
        actions={
          <>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search users…"
                className="h-11 w-full rounded-[14px] border border-border bg-background pr-3 pl-9 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-56"
              />
            </div>
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="btn-primary inline-flex h-11 items-center gap-1.5 px-4 text-sm"
            >
              <Plus className="h-4 w-4" />
              Invite user
            </motion.button>
          </>
        }
      />

      <AdminCard>
        <AdminTable
          rows={adminUsers}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "name",
              header: "User",
              cell: (row) => (
                <div>
                  <p className="font-semibold text-foreground">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.email}</p>
                </div>
              ),
            },
            {
              key: "country",
              header: "Country",
              cell: (row) => (
                <span className="text-foreground">{row.country}</span>
              ),
            },
            {
              key: "kyc",
              header: "KYC",
              cell: (row) => <StatusBadge status={row.kyc} />,
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <StatusBadge status={row.status} />,
            },
            {
              key: "balance",
              header: "Wallet",
              cell: (row) => (
                <span className="font-semibold text-foreground">
                  {row.balance}
                </span>
              ),
            },
            {
              key: "actions",
              header: "",
              cell: () => (
                <button
                  type="button"
                  className="text-sm font-semibold text-primary"
                >
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
