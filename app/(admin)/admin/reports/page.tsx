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
  const max = Math.max(
    1,
    ...series.map((s) => {
      const total = Number(s.total);
      return Number.isFinite(total) ? total : 0;
    }),
  );
  const barMaxPx = 168;

  function barHeight(total: number) {
    const value = Number(total);
    if (!Number.isFinite(value) || value <= 0) return 6;
    return Math.max(8, Math.round((value / max) * barMaxPx));
  }

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
              <div className="-mx-1 overflow-x-auto px-1 pb-1">
                <div className="flex h-56 min-w-[420px] items-end gap-2 sm:min-w-0 sm:gap-3">
                  {series.map((item) => {
                    const day = String(item.day || "");
                    const height = barHeight(item.total);
                    return (
                      <div
                        key={day || item.total}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                        title={`${day}: ${Number(item.total).toLocaleString()} · ${item.count} transactions`}
                      >
                        <div className="flex w-full flex-1 items-end justify-center">
                          <div
                            className="w-full max-w-10 rounded-t-[10px] bg-gradient-to-t from-oryno-orange to-oryno-orange-soft"
                            style={{ height }}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                          <span className="sm:hidden">{day.slice(8)}</span>
                          <span className="hidden sm:inline">{day.slice(5)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
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
