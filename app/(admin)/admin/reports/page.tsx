"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type Response = {
  summary: { volume30d: string; transactions30d: number };
  series: Array<{ day: string; total: number; count: number }>;
  categories: Array<{ category: string; total: string; count: number }>;
  statuses: Array<{ status: string; count: number }>;
};

export default function AdminReportsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/reports");

  const series = data?.series?.slice(-14) || [];
  const max = Math.max(1, ...series.map((s) => s.total));

  function exportCsv() {
    if (!data) return;
    const lines = [
      "day,total,count",
      ...data.series.map((s) => `${s.day},${s.total},${s.count}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oryno-transactions-30d.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const completed =
    data?.statuses.find((s) => s.status === "Completed")?.count || 0;
  const totalStatus =
    data?.statuses.reduce((s, row) => s + row.count, 0) || 0;
  const successRate =
    totalStatus > 0 ? ((completed / totalStatus) * 100).toFixed(1) : "—";

  return (
    <>
      <AdminPageHeader
        title="Reports & Analytics"
        subtitle="Volume and category performance from the ledger (30 days)"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportCsv}
            disabled={!data?.series?.length}
            className="btn-secondary h-11 px-4 text-sm disabled:opacity-50"
          >
            Export CSV
          </motion.button>
        }
      />

      {loading ? <AdminLoadingBlock variant="reports" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross volume"
              value={data.summary.volume30d}
              change="Last 30 days"
              up
            />
            <StatCard
              label="Transactions"
              value={String(data.summary.transactions30d)}
              change="Last 30 days"
              up
              delay={0.05}
            />
            <StatCard
              label="Completed rate"
              value={successRate === "—" ? "—" : `${successRate}%`}
              change="By status"
              up
              delay={0.1}
            />
            <StatCard
              label="Categories"
              value={String(data.categories.length)}
              change="Active buckets"
              up
              delay={0.15}
            />
          </div>

          <AdminCard title="Daily transaction volume" delay={0.12}>
            {series.length === 0 ? (
              <AdminEmptyBlock message="No transactions in the last 30 days." />
            ) : (
              <div className="flex h-52 items-end gap-2 sm:gap-3">
                {series.map((item, index) => (
                  <div
                    key={item.day}
                    className="flex flex-1 flex-col items-center gap-2"
                    title={`${item.day}: ${item.total}`}
                  >
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{
                        height: `${Math.max(6, (item.total / max) * 100)}%`,
                      }}
                      transition={{ delay: 0.1 + index * 0.03, duration: 0.45 }}
                      className="w-full max-w-10 rounded-t-[10px] bg-gradient-to-t from-oryno-orange to-oryno-orange-soft"
                    />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {item.day.slice(5)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <div className="mt-5 grid gap-5 lg:grid-cols-3">
            {data.categories.slice(0, 3).map((item, index) => (
              <AdminCard key={item.category} delay={0.16 + index * 0.04}>
                <p className="text-sm text-muted-foreground">{item.category}</p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {item.total}
                </p>
                <p className="mt-1 text-xs font-semibold text-primary">
                  {item.count} transactions
                </p>
              </AdminCard>
            ))}
            {data.categories.length === 0 ? (
              <AdminEmptyBlock message="No category breakdown yet." />
            ) : null}
          </div>
        </>
      ) : null}
    </>
  );
}
