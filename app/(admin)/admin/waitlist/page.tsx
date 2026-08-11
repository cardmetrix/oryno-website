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
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { USD_CARD_ISSUER } from "@/lib/support/config";

type Entry = {
  id: string;
  email: string;
  name: string;
  countryCode: string | null;
  provider: string;
  joinedAt: string;
};

export default function AdminUsdWaitlistPage() {
  const { data, loading, error, reload } = useAdminQuery<{
    count: number;
    entries: Entry[];
  }>("/api/admin/waitlist/usd-card");

  return (
    <>
      <AdminPageHeader
        title="USD virtual card waitlist"
        subtitle={`Users waiting for ${USD_CARD_ISSUER}-issued USD cards`}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <StatCard label="Joined" value={String(data?.count ?? 0)} />
        <StatCard label="Issuer" value={USD_CARD_ISSUER} delay={0.04} />
      </div>
      <AdminCard>
        {loading ? <AdminLoadingBlock /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {!loading && !error && !data?.entries.length ? (
          <AdminEmptyBlock message="No waitlist signups yet." />
        ) : null}
        {!loading && !error && data?.entries.length ? (
          <AdminTable
            rows={data.entries}
            rowKey={(row) => row.id}
            columns={[
              {
                key: "user",
                header: "User",
                cell: (row) => (
                  <div>
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.email}</p>
                  </div>
                ),
              },
              {
                key: "country",
                header: "Country",
                cell: (row) => row.countryCode || "—",
              },
              {
                key: "provider",
                header: "Issuer",
                hideOnMobile: true,
                cell: (row) => row.provider,
              },
              {
                key: "joined",
                header: "Joined",
                cell: (row) =>
                  new Date(row.joinedAt).toLocaleString("en-NG", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }),
              },
            ]}
          />
        ) : null}
      </AdminCard>
    </>
  );
}
