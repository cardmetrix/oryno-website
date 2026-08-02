"use client";

import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminTable } from "@/components/admin/admin-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type Response = {
  campaigns: Array<{
    id: string;
    title: string;
    audience: string;
    status: string;
    when: string;
  }>;
  recent: Array<{ id: string; title: string; type: string; when: string }>;
};

export default function AdminNotificationsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/notifications");

  return (
    <>
      <AdminPageHeader
        title="Notifications"
        subtitle="Campaigns and recent user notifications"
      />

      {loading ? <AdminLoadingBlock /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <AdminCard title="Campaigns" delay={0.05}>
            {data.campaigns.length === 0 ? (
              <AdminEmptyBlock message="No campaigns yet." />
            ) : (
              <AdminTable
                rows={data.campaigns}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "title",
                    header: "Title",
                    cell: (row) => (
                      <span className="font-semibold">{row.title}</span>
                    ),
                  },
                  {
                    key: "audience",
                    header: "Audience",
                    cell: (row) => row.audience,
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.status} />,
                  },
                  { key: "when", header: "When", cell: (row) => row.when },
                ]}
              />
            )}
          </AdminCard>

          <AdminCard title="Recent user notifications" delay={0.1}>
            {data.recent.length === 0 ? (
              <AdminEmptyBlock message="No notifications sent yet." />
            ) : (
              <AdminTable
                rows={data.recent}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "title",
                    header: "Title",
                    cell: (row) => (
                      <span className="font-semibold">{row.title}</span>
                    ),
                  },
                  { key: "type", header: "Type", cell: (row) => row.type },
                  { key: "when", header: "When", cell: (row) => row.when },
                ]}
              />
            )}
          </AdminCard>
        </div>
      ) : null}
    </>
  );
}
