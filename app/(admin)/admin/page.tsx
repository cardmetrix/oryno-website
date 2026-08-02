"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Activity } from "lucide-react";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";
import { StatusBadge } from "@/components/admin/status-badge";
import { useAdminQuery } from "@/lib/admin/use-admin-query";

type OverviewResponse = {
  stats: Array<{ label: string; value: string; change: string; up: boolean }>;
  giftCardOrders: Array<{
    id: string;
    user: string;
    brand: string;
    type: string;
    status: string;
  }>;
  activity: Array<{ id: string; title: string; type: string; time: string }>;
  countries: Array<{
    code: string;
    name: string;
    currency: string;
    gateway: string;
    services: string;
    status: string;
  }>;
};

export default function AdminOverviewPage() {
  const { data, loading, error, reload } =
    useAdminQuery<OverviewResponse>("/api/admin/overview");

  return (
    <>
      <AdminPageHeader
        title="Overview"
        subtitle="Live pulse across users, wallets, and country configs"
        actions={
          <>
            <Link
              href="/admin/countries"
              className="btn-secondary inline-flex h-11 items-center px-4 text-sm"
            >
              Countries
            </Link>
            <Link
              href="/admin/reports"
              className="btn-primary inline-flex h-11 items-center gap-1.5 px-4 text-sm"
            >
              Reports
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </>
        }
      />

      {loading ? <AdminLoadingBlock /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {data.stats.map((stat, index) => (
              <StatCard key={stat.label} {...stat} delay={index * 0.05} />
            ))}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <AdminCard title="Recent gift card orders" delay={0.12}>
              {data.giftCardOrders.length === 0 ? (
                <AdminEmptyBlock message="No gift card orders yet." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="pb-3 font-semibold">Order</th>
                        <th className="pb-3 font-semibold">User</th>
                        <th className="pb-3 font-semibold">Brand</th>
                        <th className="pb-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.giftCardOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="py-3 font-semibold text-foreground">
                            {order.id}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {order.user}
                          </td>
                          <td className="py-3 text-foreground">
                            {order.brand} · {order.type}
                          </td>
                          <td className="py-3">
                            <StatusBadge status={order.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </AdminCard>

            <AdminCard title="Activity" delay={0.16}>
              {data.activity.length === 0 ? (
                <AdminEmptyBlock message="No recent transactions." />
              ) : (
                <div className="space-y-3">
                  {data.activity.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.18 + index * 0.04 }}
                      className="flex items-start gap-3 rounded-[16px] border border-border/80 px-3.5 py-3"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-oryno-orange-muted text-primary">
                        <Activity className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.type} · {item.time}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </AdminCard>
          </div>

          <AdminCard title="Country configuration" delay={0.2} className="mt-5">
            {data.countries.length === 0 ? (
              <AdminEmptyBlock message="No countries configured." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.countries.map((country, index) => (
                  <motion.div
                    key={country.code}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 + index * 0.04 }}
                    whileHover={{ y: -3 }}
                    className="rounded-[18px] border border-border bg-muted/40 p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-bold text-foreground">
                        {country.name}
                      </p>
                      <StatusBadge status={country.status} />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {country.currency} · {country.gateway}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {country.services}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </AdminCard>
        </>
      ) : null}
    </>
  );
}
