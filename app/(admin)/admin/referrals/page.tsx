"use client";

import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { referralRows } from "@/lib/admin-data";

export default function AdminReferralsPage() {
  return (
    <>
      <AdminPageHeader
        title="Referrals"
        subtitle="Codes, earnings, and reward configuration"
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard label="Active codes" value="2,481" change="+6% WoW" up delay={0} />
        <StatCard label="Joined via referral" value="18,940" change="Lifetime" up delay={0.05} />
        <StatCard label="Rewards paid" value="₦42.8M" change="Local currency routed" up delay={0.1} />
      </div>

      <AdminCard title="Top referral codes" delay={0.12}>
        <AdminTable
          rows={referralRows.map((r) => ({ ...r, id: r.code }))}
          rowKey={(row) => row.id}
          columns={[
            {
              key: "code",
              header: "Code",
              cell: (row) => (
                <span className="font-semibold text-foreground">{row.code}</span>
              ),
            },
            { key: "owner", header: "Owner", cell: (row) => row.owner },
            { key: "joins", header: "Joins", cell: (row) => row.joins },
            {
              key: "earnings",
              header: "Earnings",
              cell: (row) => (
                <span className="font-semibold text-foreground">
                  {row.earnings}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              cell: (row) => <StatusBadge status={row.status} />,
            },
          ]}
        />
      </AdminCard>
    </>
  );
}
