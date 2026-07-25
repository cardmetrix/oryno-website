"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatCard } from "@/components/admin/stat-card";

const series = [
  { label: "Mon", value: 42 },
  { label: "Tue", value: 58 },
  { label: "Wed", value: 51 },
  { label: "Thu", value: 72 },
  { label: "Fri", value: 88 },
  { label: "Sat", value: 64 },
  { label: "Sun", value: 70 },
];

export default function AdminReportsPage() {
  const max = Math.max(...series.map((s) => s.value));

  return (
    <>
      <AdminPageHeader
        title="Reports & Analytics"
        subtitle="Volume, success rates, and country performance"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-secondary h-11 px-4 text-sm"
          >
            Export CSV
          </motion.button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Gross volume" value="₦128.4M" change="This week" up />
        <StatCard label="Success rate" value="98.7%" change="+0.4 pts" up delay={0.05} />
        <StatCard label="Avg payout time" value="14 min" change="Within SLA" up delay={0.1} />
        <StatCard label="Support tickets" value="126" change="-11%" up delay={0.15} />
      </div>

      <AdminCard title="Weekly transaction volume" delay={0.12}>
        <div className="flex h-52 items-end gap-3 sm:gap-4">
          {series.map((item, index) => (
            <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(item.value / max) * 100}%` }}
                transition={{ delay: 0.15 + index * 0.05, duration: 0.5 }}
                className="w-full max-w-12 rounded-t-[12px] bg-gradient-to-t from-oryno-orange to-oryno-orange-soft"
              />
              <span className="text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </AdminCard>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {[
          { title: "Airtime & Data", value: "41%", note: "Highest volume" },
          { title: "Bills & TV", value: "27%", note: "Stable growth" },
          { title: "Wallet transfers", value: "32%", note: "Payout heavy" },
        ].map((item, index) => (
          <AdminCard key={item.title} delay={0.16 + index * 0.04}>
            <p className="text-sm text-muted-foreground">{item.title}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{item.value}</p>
            <p className="mt-1 text-xs font-semibold text-primary">{item.note}</p>
          </AdminCard>
        ))}
      </div>
    </>
  );
}
