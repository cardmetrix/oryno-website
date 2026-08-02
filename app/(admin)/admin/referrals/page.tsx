"use client";

import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type Response = {
  stats: { codes: number; joins: number; earnings: string };
  referrals: Array<{
    code: string;
    owner: string;
    joins: number;
    earnings: string;
    status: string;
  }>;
};

export default function AdminReferralsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/referrals");

  return (
    <>
      <AdminPageHeader
        title="Referrals"
        subtitle="Codes, joins, and earnings from the database"
      />

      {loading ? <AdminLoadingBlock /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Codes"
              value={String(data.stats.codes)}
              change="All time"
              up
            />
            <StatCard
              label="Joined via referral"
              value={String(data.stats.joins)}
              change="Lifetime joins"
              up
              delay={0.05}
            />
            <StatCard
              label="Rewards tracked"
              value={data.stats.earnings}
              change="From referral codes"
              up
              delay={0.1}
            />
          </div>

          <AdminCard title="Referral codes" delay={0.12}>
            {data.referrals.length === 0 ? (
              <AdminEmptyBlock message="No referral codes yet." />
            ) : (
              <AdminTable
                rows={data.referrals.map((r) => ({ ...r, id: r.code }))}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "code",
                    header: "Code",
                    cell: (row) => (
                      <span className="font-semibold text-foreground">
                        {row.code}
                      </span>
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
            )}
          </AdminCard>
        </>
      ) : null}
    </>
  );
}
