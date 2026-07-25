"use client";

import { motion } from "framer-motion";
import { AdminCard } from "@/components/admin/admin-card";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { countriesConfig } from "@/lib/admin-data";

export default function AdminCountriesPage() {
  return (
    <>
      <AdminPageHeader
        title="Countries"
        subtitle="Currency, services, gateways, and payout routing — config-driven"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary h-11 px-4 text-sm"
          >
            Add country
          </motion.button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {countriesConfig.map((country, index) => (
          <motion.div
            key={country.code}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ y: -3 }}
          >
            <AdminCard className="h-full">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-bold text-foreground">
                    {country.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {country.code} · {country.currency}
                  </p>
                </div>
                <StatusBadge status={country.status} />
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <Row label="Gateway" value={country.gateway} />
                <Row label="Services" value={country.services} />
                <Row
                  label="Payout"
                  value="Auto-routed by country detection"
                />
              </div>

              <div className="mt-5 flex gap-2">
                <button type="button" className="btn-primary h-10 px-4 text-sm">
                  Configure
                </button>
                <button
                  type="button"
                  className="btn-secondary h-10 px-4 text-sm"
                >
                  Providers
                </button>
              </div>
            </AdminCard>
          </motion.div>
        ))}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[14px] bg-muted/40 px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
